//! Rolls raw 500 ms samples up into hourly, daily and monthly usage rows.
//!
//! Design notes:
//! - Byte totals are `Σ bps × duration` using each sample's measured duration,
//!   so skipped ticks (slow ping, system load, sleep) don't undercount usage.
//! - [`catch_up`] rolls up *every* completed hour that has samples but no row,
//!   so a laptop that sleeps across an hour or midnight boundary is repaired
//!   on wake instead of losing the hours it slept through.
//! - Local hour/day boundaries come from [`local_time`], which is DST-safe.
//! - Nothing here reads the clock; callers pass the time zone and `now`.

use chrono::{NaiveDate, TimeZone};
use rusqlite::{Connection, OptionalExtension};
use std::collections::{BTreeSet, HashSet};

use crate::storage::local_time::{
    day_bounds, day_key, hour_start, local_date, month_key, next_hour_start,
};
use crate::storage::repository::{
    DailyUsage, HourlyUsage, MonthlyUsage, upsert_daily, upsert_hourly, upsert_monthly,
};

/// Aggregate of raw samples over a time range.
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct SampleAggregate {
    pub count: i64,
    pub sum_download_bps: f64,
    pub sum_upload_bps: f64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
    pub download_bytes: i64,
    pub upload_bytes: i64,
}

/// Aggregates raw samples with `start <= timestamp < end`.
pub fn aggregate_samples(
    conn: &Connection,
    start: i64,
    end: i64,
) -> rusqlite::Result<SampleAggregate> {
    conn.query_row(
        "SELECT COUNT(*),
                COALESCE(SUM(download_bps), 0.0),
                COALESCE(SUM(upload_bps),   0.0),
                COALESCE(MAX(download_bps), 0.0),
                COALESCE(MAX(upload_bps),   0.0),
                COALESCE(CAST(SUM(download_bps * duration_ms) / 1000.0 AS INTEGER), 0),
                COALESCE(CAST(SUM(upload_bps   * duration_ms) / 1000.0 AS INTEGER), 0)
         FROM bandwidth_samples
         WHERE timestamp >= ?1 AND timestamp < ?2",
        [start, end],
        |r| {
            Ok(SampleAggregate {
                count: r.get(0)?,
                sum_download_bps: r.get(1)?,
                sum_upload_bps: r.get(2)?,
                peak_download_bps: r.get(3)?,
                peak_upload_bps: r.get(4)?,
                download_bytes: r.get(5)?,
                upload_bytes: r.get(6)?,
            })
        },
    )
}

/// Rolls up `[start, end)` into `hourly_usage`. Returns whether a row was
/// written (hours without samples are skipped).
pub fn rollup_hour(conn: &Connection, start: i64, end: i64) -> rusqlite::Result<bool> {
    let agg = aggregate_samples(conn, start, end)?;
    if agg.count == 0 {
        return Ok(false);
    }
    let n = agg.count as f64;
    upsert_hourly(
        conn,
        &HourlyUsage {
            hour_start: start,
            avg_download_bps: agg.sum_download_bps / n,
            avg_upload_bps: agg.sum_upload_bps / n,
            peak_download_bps: agg.peak_download_bps,
            peak_upload_bps: agg.peak_upload_bps,
            total_download_bytes: agg.download_bytes,
            total_upload_bytes: agg.upload_bytes,
            sample_count: agg.count,
        },
    )?;
    Ok(true)
}

/// Recomputes the `daily_usage` row for a local calendar day.
///
/// Combines completed `hourly_usage` rows with raw samples after the last
/// rolled-up hour, so today's row stays live while hours are still open.
pub fn rollup_day<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    date: NaiveDate,
) -> rusqlite::Result<()> {
    let (start, end) = day_bounds(tz, date);

    let (weighted_dl, weighted_ul, hourly_count, peak_dl, peak_ul, bytes_dl, bytes_ul, last_hour): (
        f64,
        f64,
        i64,
        f64,
        f64,
        i64,
        i64,
        Option<i64>,
    ) = conn.query_row(
        "SELECT COALESCE(SUM(avg_download_bps * sample_count), 0.0),
                COALESCE(SUM(avg_upload_bps   * sample_count), 0.0),
                COALESCE(SUM(sample_count), 0),
                COALESCE(MAX(peak_download_bps), 0.0),
                COALESCE(MAX(peak_upload_bps),   0.0),
                COALESCE(SUM(total_download_bytes), 0),
                COALESCE(SUM(total_upload_bytes),   0),
                MAX(hour_start)
         FROM hourly_usage
         WHERE hour_start >= ?1 AND hour_start < ?2",
        [start, end],
        |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
            ))
        },
    )?;

    // Raw samples not yet covered by an hourly row.
    let raw_from = last_hour
        .map(|h| next_hour_start(tz, h).max(start))
        .unwrap_or(start);
    let raw = aggregate_samples(conn, raw_from, end)?;

    let count = hourly_count + raw.count;
    if count == 0 {
        return Ok(());
    }
    let n = count as f64;

    upsert_daily(
        conn,
        &DailyUsage {
            day: day_key(date),
            avg_download_bps: (weighted_dl + raw.sum_download_bps) / n,
            avg_upload_bps: (weighted_ul + raw.sum_upload_bps) / n,
            peak_download_bps: peak_dl.max(raw.peak_download_bps),
            peak_upload_bps: peak_ul.max(raw.peak_upload_bps),
            total_download_bytes: bytes_dl + raw.download_bytes,
            total_upload_bytes: bytes_ul + raw.upload_bytes,
        },
    )
}

/// Recomputes the `monthly_usage` row for `month` ("YYYY-MM") from daily rows.
pub fn rollup_month(conn: &Connection, month: &str) -> rusqlite::Result<()> {
    let (total_dl, total_ul, peak_dl, peak_ul, count): (i64, i64, f64, f64, i64) = conn.query_row(
        "SELECT COALESCE(SUM(total_download_bytes), 0),
                COALESCE(SUM(total_upload_bytes),   0),
                COALESCE(MAX(peak_download_bps),    0.0),
                COALESCE(MAX(peak_upload_bps),      0.0),
                COUNT(*)
         FROM daily_usage
         WHERE day LIKE ?1",
        [format!("{month}-%")],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )?;
    if count == 0 {
        return Ok(());
    }
    upsert_monthly(
        conn,
        &MonthlyUsage {
            month: month.to_string(),
            total_download_bytes: total_dl,
            total_upload_bytes: total_ul,
            peak_download_bps: peak_dl,
            peak_upload_bps: peak_ul,
        },
    )
}

/// Refreshes today's live daily row (called every few seconds).
pub fn refresh_today<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    now_ts: i64,
) -> rusqlite::Result<()> {
    rollup_day(conn, tz, local_date(tz, now_ts))
}

/// What [`catch_up`] wrote, for logging and tests.
#[derive(Debug, Default, PartialEq)]
pub struct CatchUpReport {
    pub hours: usize,
    pub days: usize,
    pub months: usize,
}

/// Brings all rollups up to date as of `now_ts`.
///
/// Safe to call any time; it only does work for hours that are complete,
/// have raw samples and have no row yet, and the days/months they affect.
/// Called at startup and whenever the local hour changes.
pub fn catch_up<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    now_ts: i64,
) -> rusqlite::Result<CatchUpReport> {
    let mut report = CatchUpReport::default();

    let earliest: Option<i64> = conn
        .query_row("SELECT MIN(timestamp) FROM bandwidth_samples", [], |r| {
            r.get(0)
        })
        .optional()?
        .flatten();
    let Some(earliest) = earliest else {
        return Ok(report);
    };

    let tx = conn.unchecked_transaction()?;
    let today = local_date(tz, now_ts);
    let current_hour = hour_start(tz, now_ts);
    let first_hour = hour_start(tz, earliest);
    let mut dates: BTreeSet<NaiveDate> = BTreeSet::new();

    // ── Hours ────────────────────────────────────────────────────────────────
    let existing_hours: HashSet<i64> = {
        let mut stmt = tx.prepare("SELECT hour_start FROM hourly_usage WHERE hour_start >= ?1")?;
        stmt.query_map([first_hour], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?
    };
    let mut h = first_hour;
    while h < current_hour {
        let next = next_hour_start(tz, h);
        if !existing_hours.contains(&h) && rollup_hour(&tx, h, next)? {
            report.hours += 1;
            dates.insert(local_date(tz, h));
        }
        h = next;
    }

    // ── Days ─────────────────────────────────────────────────────────────────
    // The day the last completed hour belonged to (picks up its final
    // seconds after midnight), today, and any day with samples but no row.
    if current_hour > first_hour {
        dates.insert(local_date(tz, current_hour - 1));
    }
    dates.insert(today);
    let existing_days: HashSet<String> = {
        let mut stmt = tx.prepare("SELECT day FROM daily_usage WHERE day >= ?1")?;
        stmt.query_map([day_key(local_date(tz, earliest))], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?
    };
    let mut d = local_date(tz, earliest);
    while d < today {
        if !existing_days.contains(&day_key(d)) {
            dates.insert(d);
        }
        match d.succ_opt() {
            Some(next) => d = next,
            None => break,
        }
    }
    for date in &dates {
        rollup_day(&tx, tz, *date)?;
        report.days += 1;
    }

    // ── Months ───────────────────────────────────────────────────────────────
    // Completed months whose days changed, plus any completed month that has
    // daily rows but no monthly row. The current month is computed live.
    let current_month = month_key(today);
    let mut months: BTreeSet<String> = dates
        .iter()
        .map(|d| month_key(*d))
        .filter(|m| *m < current_month)
        .collect();
    {
        let mut stmt = tx.prepare(
            "SELECT DISTINCT SUBSTR(day, 1, 7) AS m FROM daily_usage
             WHERE m < ?1 AND m NOT IN (SELECT month FROM monthly_usage)",
        )?;
        for m in stmt.query_map([&current_month], |r| r.get::<_, String>(0))? {
            months.insert(m?);
        }
    }
    for month in &months {
        rollup_month(&tx, month)?;
        report.months += 1;
    }

    tx.commit()?;
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::migrations::get_migrations;
    use crate::storage::repository::insert_sample;
    use chrono_tz::Asia::Kolkata;
    use chrono_tz::Europe::Berlin;

    fn db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        get_migrations().to_latest(&mut conn).unwrap();
        conn
    }

    fn at<Tz: TimeZone>(tz: &Tz, y: i32, m: u32, d: u32, h: u32, min: u32) -> i64 {
        tz.with_ymd_and_hms(y, m, d, h, min, 0)
            .earliest()
            .unwrap()
            .timestamp()
    }

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    /// One sample per second at 1000 B/s down, 100 B/s up.
    fn fill(conn: &Connection, start: i64, secs: i64) {
        for t in start..start + secs {
            insert_sample(conn, t, "eth0", 1000.0, 100.0, 1000).unwrap();
        }
    }

    fn daily(conn: &Connection, day: &str) -> Option<(i64, i64)> {
        conn.query_row(
            "SELECT total_download_bytes, total_upload_bytes FROM daily_usage WHERE day = ?1",
            [day],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .unwrap()
    }

    #[test]
    fn bytes_use_sample_duration_not_a_fixed_half_second() {
        let conn = db();
        // Two samples, each covering 2 s at 1000 B/s (e.g. ticks were skipped).
        insert_sample(&conn, 100, "eth0", 1000.0, 0.0, 2000).unwrap();
        insert_sample(&conn, 102, "eth0", 1000.0, 0.0, 2000).unwrap();
        let agg = aggregate_samples(&conn, 0, 1000).unwrap();
        assert_eq!(agg.download_bytes, 4000);
    }

    #[test]
    fn catch_up_rolls_up_every_hour_missed_while_asleep() {
        let conn = db();
        let tz = &Kolkata;
        // Active 23:30–24:00, then the machine sleeps until 08:10.
        fill(&conn, at(tz, 2026, 5, 1, 23, 30), 1800);
        let wake = at(tz, 2026, 5, 2, 8, 10);
        fill(&conn, at(tz, 2026, 5, 2, 8, 0), 600);

        let report = catch_up(&conn, tz, wake).unwrap();
        assert_eq!(report.hours, 1, "the 23:00 hour must be rolled up");
        assert_eq!(daily(&conn, "2026-05-01"), Some((1_800_000, 180_000)));
        // Today is live: completed hours + raw samples of the open hour.
        assert_eq!(daily(&conn, "2026-05-02"), Some((600_000, 60_000)));
    }

    #[test]
    fn stale_daily_row_is_repaired_after_sleep() {
        let conn = db();
        let tz = &Kolkata;
        fill(&conn, at(tz, 2026, 5, 1, 22, 0), 3600);
        // A live snapshot taken at 22:30 left a partial row behind.
        refresh_today(&conn, tz, at(tz, 2026, 5, 1, 22, 30)).unwrap();
        fill(&conn, at(tz, 2026, 5, 1, 23, 0), 1800);

        catch_up(&conn, tz, at(tz, 2026, 5, 2, 7, 0)).unwrap();
        assert_eq!(daily(&conn, "2026-05-01"), Some((5_400_000, 540_000)));
    }

    #[test]
    fn dst_fall_back_day_counts_all_25_hours() {
        let conn = db();
        let tz = &Berlin;
        let (start, end) = day_bounds(tz, date(2026, 10, 25));
        // One sample per minute across the whole 25-hour day.
        for t in (start..end).step_by(60) {
            insert_sample(&conn, t, "eth0", 1000.0, 0.0, 60_000).unwrap();
        }
        let report = catch_up(&conn, tz, end + 600).unwrap();
        assert_eq!(report.hours, 25);
        assert_eq!(daily(&conn, "2026-10-25"), Some((25 * 3600 * 1000, 0)));
    }

    #[test]
    fn catch_up_during_repeated_hour_does_not_panic() {
        let conn = db();
        let tz = &Berlin;
        let first_230 = at(tz, 2026, 10, 25, 2, 30);
        fill(&conn, first_230 - 3600, 60);
        catch_up(&conn, tz, first_230 + 3600).unwrap();
        refresh_today(&conn, tz, first_230 + 3600).unwrap();
    }

    #[test]
    fn catch_up_is_idempotent() {
        let conn = db();
        let tz = &Kolkata;
        fill(&conn, at(tz, 2026, 5, 1, 10, 0), 600);
        let now = at(tz, 2026, 5, 1, 12, 0);
        assert_eq!(catch_up(&conn, tz, now).unwrap().hours, 1);
        assert_eq!(catch_up(&conn, tz, now).unwrap().hours, 0);
        assert_eq!(daily(&conn, "2026-05-01"), Some((600_000, 60_000)));
    }

    #[test]
    fn completed_month_is_rolled_up_on_the_first() {
        let conn = db();
        let tz = &Kolkata;
        fill(&conn, at(tz, 2026, 4, 30, 23, 0), 600);
        catch_up(&conn, tz, at(tz, 2026, 5, 1, 0, 5)).unwrap();
        let month: (i64,) = conn
            .query_row(
                "SELECT total_download_bytes FROM monthly_usage WHERE month = '2026-04'",
                [],
                |r| Ok((r.get(0)?,)),
            )
            .unwrap();
        assert_eq!(month.0, 600_000);
    }

    #[test]
    fn current_month_is_not_written_to_monthly_usage() {
        let conn = db();
        let tz = &Kolkata;
        fill(&conn, at(tz, 2026, 5, 3, 9, 0), 60);
        catch_up(&conn, tz, at(tz, 2026, 5, 3, 11, 0)).unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM monthly_usage", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn empty_database_is_a_no_op() {
        let conn = db();
        assert_eq!(
            catch_up(&conn, &Kolkata, 1_800_000_000).unwrap(),
            CatchUpReport::default()
        );
    }
}
