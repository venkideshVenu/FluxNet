use chrono::{Local, TimeZone};
use rusqlite::{Connection, OptionalExtension, params};

use crate::storage::aggregation::aggregate_samples;
use crate::storage::local_time::{day_bounds, day_key, local_date, month_key};
use serde::Serialize;

// ── Serialisable types returned to the frontend ───────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthSample {
    pub timestamp: i64,
    pub download_bps: f64,
    pub upload_bps: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HourlyUsage {
    pub hour_start: i64,
    pub avg_download_bps: f64,
    pub avg_upload_bps: f64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
    pub total_download_bytes: i64,
    pub total_upload_bytes: i64,
    pub sample_count: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyUsage {
    pub day: String, // "YYYY-MM-DD"
    pub avg_download_bps: f64,
    pub avg_upload_bps: f64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
    pub total_download_bytes: i64,
    pub total_upload_bytes: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyUsage {
    pub month: String, // "YYYY-MM"
    pub total_download_bytes: i64,
    pub total_upload_bytes: i64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
}

/// Aggregate summary returned to the dashboard stats cards.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub today_download_bytes: i64,
    pub today_upload_bytes: i64,
    pub week_download_bytes: i64,
    pub week_upload_bytes: i64,
    pub month_download_bytes: i64,
    pub month_upload_bytes: i64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
}

// ── Writes ────────────────────────────────────────────────────────────────────

/// Insert one raw bandwidth sample covering `duration_ms` of measurement.
pub fn insert_sample(
    conn: &Connection,
    timestamp: i64,
    interface_name: &str,
    download_bps: f64,
    upload_bps: f64,
    duration_ms: i64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO bandwidth_samples
             (timestamp, interface_name, download_bps, upload_bps, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            timestamp,
            interface_name,
            download_bps,
            upload_bps,
            duration_ms
        ],
    )?;
    Ok(())
}

/// Delete raw samples older than `cutoff_ts` (Unix seconds).
/// Called every 60 s from the background task to keep the table at ≤ 7 days.
pub fn cleanup_old_samples(conn: &Connection, cutoff_ts: i64) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM bandwidth_samples WHERE timestamp < ?1",
        params![cutoff_ts],
    )?;
    Ok(())
}

// ── Aggregation upserts ───────────────────────────────────────────────────────

pub fn upsert_hourly(conn: &Connection, u: &HourlyUsage) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO hourly_usage
             (hour_start, avg_download_bps, avg_upload_bps,
              peak_download_bps, peak_upload_bps,
              total_download_bytes, total_upload_bytes, sample_count)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(hour_start) DO UPDATE SET
             avg_download_bps     = excluded.avg_download_bps,
             avg_upload_bps       = excluded.avg_upload_bps,
             peak_download_bps    = excluded.peak_download_bps,
             peak_upload_bps      = excluded.peak_upload_bps,
             total_download_bytes = excluded.total_download_bytes,
             total_upload_bytes   = excluded.total_upload_bytes,
             sample_count         = excluded.sample_count",
        params![
            u.hour_start,
            u.avg_download_bps,
            u.avg_upload_bps,
            u.peak_download_bps,
            u.peak_upload_bps,
            u.total_download_bytes,
            u.total_upload_bytes,
            u.sample_count,
        ],
    )?;
    Ok(())
}

pub fn upsert_daily(conn: &Connection, u: &DailyUsage) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO daily_usage
             (day, avg_download_bps, avg_upload_bps,
              peak_download_bps, peak_upload_bps,
              total_download_bytes, total_upload_bytes)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(day) DO UPDATE SET
             avg_download_bps     = excluded.avg_download_bps,
             avg_upload_bps       = excluded.avg_upload_bps,
             peak_download_bps    = excluded.peak_download_bps,
             peak_upload_bps      = excluded.peak_upload_bps,
             total_download_bytes = excluded.total_download_bytes,
             total_upload_bytes   = excluded.total_upload_bytes",
        params![
            u.day,
            u.avg_download_bps,
            u.avg_upload_bps,
            u.peak_download_bps,
            u.peak_upload_bps,
            u.total_download_bytes,
            u.total_upload_bytes,
        ],
    )?;
    Ok(())
}

pub fn upsert_monthly(conn: &Connection, u: &MonthlyUsage) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO monthly_usage
             (month, total_download_bytes, total_upload_bytes,
              peak_download_bps, peak_upload_bps)
         VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(month) DO UPDATE SET
             total_download_bytes = excluded.total_download_bytes,
             total_upload_bytes   = excluded.total_upload_bytes,
             peak_download_bps    = excluded.peak_download_bps,
             peak_upload_bps      = excluded.peak_upload_bps",
        params![
            u.month,
            u.total_download_bytes,
            u.total_upload_bytes,
            u.peak_download_bps,
            u.peak_upload_bps,
        ],
    )?;
    Ok(())
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/// Raw samples from `since_ts` onwards, ascending — used by the live history chart.
pub fn get_samples_since(
    conn: &Connection,
    since_ts: i64,
) -> rusqlite::Result<Vec<BandwidthSample>> {
    let mut stmt = conn.prepare(
        "SELECT timestamp, download_bps, upload_bps
         FROM bandwidth_samples
         WHERE timestamp >= ?1
         ORDER BY timestamp ASC",
    )?;
    let rows = stmt.query_map(params![since_ts], |row| {
        Ok(BandwidthSample {
            timestamp: row.get(0)?,
            download_bps: row.get(1)?,
            upload_bps: row.get(2)?,
        })
    })?;
    rows.collect()
}

/// Hourly rows from `since_ts` onwards, ascending — used for the 24/48 h chart.
pub fn get_hourly_since(conn: &Connection, since_ts: i64) -> rusqlite::Result<Vec<HourlyUsage>> {
    let mut stmt = conn.prepare(
        "SELECT hour_start, avg_download_bps, avg_upload_bps,
                peak_download_bps, peak_upload_bps,
                total_download_bytes, total_upload_bytes, sample_count
         FROM hourly_usage
         WHERE hour_start >= ?1
         ORDER BY hour_start ASC",
    )?;
    let rows = stmt.query_map(params![since_ts], |row| {
        Ok(HourlyUsage {
            hour_start: row.get(0)?,
            avg_download_bps: row.get(1)?,
            avg_upload_bps: row.get(2)?,
            peak_download_bps: row.get(3)?,
            peak_upload_bps: row.get(4)?,
            total_download_bytes: row.get(5)?,
            total_upload_bytes: row.get(6)?,
            sample_count: row.get(7)?,
        })
    })?;
    rows.collect()
}

/// Most-recent `n` daily rows, returned in ascending date order.
pub fn get_daily_last_n(conn: &Connection, n: i64) -> rusqlite::Result<Vec<DailyUsage>> {
    let mut stmt = conn.prepare(
        "SELECT day, avg_download_bps, avg_upload_bps,
                peak_download_bps, peak_upload_bps,
                total_download_bytes, total_upload_bytes
         FROM daily_usage
         ORDER BY day DESC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![n], |row| {
        Ok(DailyUsage {
            day: row.get(0)?,
            avg_download_bps: row.get(1)?,
            avg_upload_bps: row.get(2)?,
            peak_download_bps: row.get(3)?,
            peak_upload_bps: row.get(4)?,
            total_download_bytes: row.get(5)?,
            total_upload_bytes: row.get(6)?,
        })
    })?;
    // Query DESC to get the most-recent N rows, then reverse for ascending chart order.
    let mut result: Vec<DailyUsage> = rows.collect::<rusqlite::Result<_>>()?;
    result.reverse();
    Ok(result)
}

/// All monthly rows in ascending order.
pub fn get_monthly_all(conn: &Connection) -> rusqlite::Result<Vec<MonthlyUsage>> {
    let mut stmt = conn.prepare(
        "SELECT month, total_download_bytes, total_upload_bytes,
                peak_download_bps, peak_upload_bps
         FROM monthly_usage
         ORDER BY month ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(MonthlyUsage {
            month: row.get(0)?,
            total_download_bytes: row.get(1)?,
            total_upload_bytes: row.get(2)?,
            peak_download_bps: row.get(3)?,
            peak_upload_bps: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn get_usage_stats(conn: &Connection) -> rusqlite::Result<UsageStats> {
    get_usage_stats_at(conn, &Local, Local::now().timestamp())
}

/// Today / last-7-days / this-month totals and all-time peaks as of `now_ts`.
pub fn get_usage_stats_at<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    now_ts: i64,
) -> rusqlite::Result<UsageStats> {
    let today = local_date(tz, now_ts);
    let today_key = day_key(today);
    // "Week" = today plus the 6 days before it.
    let week_start_key = day_key(today - chrono::Days::new(6));
    let month_prefix = format!("{}-%", month_key(today));

    // Today: the live daily row, or raw samples if it hasn't been written yet.
    let today_totals: Option<(i64, i64)> = conn
        .query_row(
            "SELECT total_download_bytes, total_upload_bytes FROM daily_usage WHERE day = ?1",
            [&today_key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let today_totals = match today_totals {
        Some(t) => t,
        None => {
            let (start, end) = day_bounds(tz, today);
            let agg = aggregate_samples(conn, start, end)?;
            (agg.download_bytes, agg.upload_bytes)
        }
    };

    let sum_days = |sql: &str, args: &[&dyn rusqlite::ToSql]| -> rusqlite::Result<(i64, i64)> {
        conn.query_row(sql, args, |r| Ok((r.get(0)?, r.get(1)?)))
    };

    let week_before_today = sum_days(
        "SELECT COALESCE(SUM(total_download_bytes), 0), COALESCE(SUM(total_upload_bytes), 0)
         FROM daily_usage WHERE day >= ?1 AND day < ?2",
        &[&week_start_key, &today_key],
    )?;
    let month_before_today = sum_days(
        "SELECT COALESCE(SUM(total_download_bytes), 0), COALESCE(SUM(total_upload_bytes), 0)
         FROM daily_usage WHERE day LIKE ?1 AND day <> ?2",
        &[&month_prefix, &today_key],
    )?;

    let peaks: (f64, f64) = conn.query_row(
        "SELECT MAX(COALESCE((SELECT MAX(peak_download_bps) FROM hourly_usage), 0.0),
                    COALESCE((SELECT MAX(download_bps) FROM bandwidth_samples), 0.0)),
                MAX(COALESCE((SELECT MAX(peak_upload_bps) FROM hourly_usage), 0.0),
                    COALESCE((SELECT MAX(upload_bps) FROM bandwidth_samples), 0.0))",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;

    Ok(UsageStats {
        today_download_bytes: today_totals.0,
        today_upload_bytes: today_totals.1,
        week_download_bytes: week_before_today.0 + today_totals.0,
        week_upload_bytes: week_before_today.1 + today_totals.1,
        month_download_bytes: month_before_today.0 + today_totals.0,
        month_upload_bytes: month_before_today.1 + today_totals.1,
        peak_download_bps: peaks.0,
        peak_upload_bps: peaks.1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::migrations::get_migrations;
    use chrono_tz::Asia::Kolkata;

    fn db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        get_migrations().to_latest(&mut conn).unwrap();
        conn
    }

    fn day_row(conn: &Connection, day: &str, bytes: i64) {
        upsert_daily(
            conn,
            &DailyUsage {
                day: day.into(),
                avg_download_bps: 0.0,
                avg_upload_bps: 0.0,
                peak_download_bps: 0.0,
                peak_upload_bps: 0.0,
                total_download_bytes: bytes,
                total_upload_bytes: 0,
            },
        )
        .unwrap();
    }

    fn noon(d: u32) -> i64 {
        Kolkata
            .with_ymd_and_hms(2026, 5, d, 12, 0, 0)
            .unwrap()
            .timestamp()
    }

    #[test]
    fn week_covers_exactly_seven_days_including_today() {
        let conn = db();
        for d in 1..=10 {
            day_row(&conn, &format!("2026-05-{d:02}"), 1);
        }
        let stats = get_usage_stats_at(&conn, &Kolkata, noon(10)).unwrap();
        assert_eq!(stats.week_download_bytes, 7);
        assert_eq!(stats.today_download_bytes, 1);
        assert_eq!(stats.month_download_bytes, 10);
    }

    #[test]
    fn today_falls_back_to_raw_samples() {
        let conn = db();
        day_row(&conn, "2026-05-09", 5);
        insert_sample(&conn, noon(10), "eth0", 1000.0, 10.0, 2000).unwrap();
        let stats = get_usage_stats_at(&conn, &Kolkata, noon(10)).unwrap();
        assert_eq!(stats.today_download_bytes, 2000);
        assert_eq!(stats.week_download_bytes, 2005);
        assert_eq!(stats.month_download_bytes, 2005);
        assert_eq!(stats.peak_download_bps, 1000.0);
    }

    #[test]
    fn previous_month_is_excluded_from_month_total() {
        let conn = db();
        day_row(&conn, "2026-04-30", 100);
        day_row(&conn, "2026-05-01", 1);
        let stats = get_usage_stats_at(&conn, &Kolkata, noon(1)).unwrap();
        assert_eq!(stats.month_download_bytes, 1);
        assert_eq!(stats.week_download_bytes, 101);
    }
}
