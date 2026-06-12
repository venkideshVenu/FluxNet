use chrono::{DateTime, Datelike, Local, TimeZone, Timelike};
use rusqlite::Connection;

use crate::storage::repository::{
    upsert_daily, upsert_hourly, upsert_monthly, DailyUsage, HourlyUsage, MonthlyUsage,
};

/// Each sample represents this many seconds of data.
/// Must match SAMPLER_INTERVAL_MS in sampler.rs (500ms = 0.5s).
const SAMPLE_DURATION_SECS: f64 = 0.5;

pub fn rollup_hourly(conn: &Connection, now: DateTime<Local>) -> rusqlite::Result<()> {
    // "The hour that just completed" = the hour immediately before `now`.
    let current_hour_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), now.hour(), 0, 0)
        .unwrap()
        .timestamp();
    let hour_start = current_hour_start - 3600;

    rollup_hourly_at(conn, hour_start)
}

/// Rollup hourly for a specific hour_start timestamp (used by backfill).
pub fn rollup_hourly_at(conn: &Connection, hour_start: i64) -> rusqlite::Result<()> {
    let hour_end = hour_start + 3600;

    let mut stmt = conn.prepare(
        "SELECT
            COUNT(*)                         AS sample_count,
            COALESCE(AVG(download_bps), 0.0) AS avg_download_bps,
            COALESCE(AVG(upload_bps),   0.0) AS avg_upload_bps,
            COALESCE(MAX(download_bps), 0.0) AS peak_download_bps,
            COALESCE(MAX(upload_bps),   0.0) AS peak_upload_bps,
            COALESCE(SUM(download_bps), 0.0) AS sum_download_bps,
            COALESCE(SUM(upload_bps),   0.0) AS sum_upload_bps
         FROM bandwidth_samples
         WHERE timestamp >= ?1 AND timestamp < ?2",
    )?;

    let row = stmt.query_row([hour_start, hour_end], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, f64>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, f64>(4)?,
            row.get::<_, f64>(5)?,
            row.get::<_, f64>(6)?,
        ))
    })?;

    let (count, avg_dl, avg_ul, peak_dl, peak_ul, sum_dl, sum_ul) = row;

    if count == 0 {
        return Ok(());
    }

    let total_download_bytes = (sum_dl * SAMPLE_DURATION_SECS) as i64;
    let total_upload_bytes = (sum_ul * SAMPLE_DURATION_SECS) as i64;

    upsert_hourly(
        conn,
        &HourlyUsage {
            hour_start,
            avg_download_bps: avg_dl,
            avg_upload_bps: avg_ul,
            peak_download_bps: peak_dl,
            peak_upload_bps: peak_ul,
            total_download_bytes,
            total_upload_bytes,
            sample_count: count,
        },
    )
}

/// Rollup daily for a specific day.
///
/// IMPORTANT: This combines completed hourly rollups WITH raw samples from
/// the current incomplete hour, so "today" totals update in real-time.
pub fn rollup_daily_at(
    conn: &Connection,
    day_start_ts: i64,
    day_str: &str,
) -> rusqlite::Result<()> {
    let day_end = day_start_ts + 86_400;

    // Determine the current hour boundary so we know which samples are
    // already covered by hourly_usage and which are "live" (current hour).
    let now = Local::now();
    let current_hour_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), now.hour(), 0, 0)
        .unwrap()
        .timestamp();

    // ── Part 1: Sum from completed hourly rollups for this day ────────────────
    let hourly_result: (f64, f64, f64, f64, i64, i64, i64) = conn
        .query_row(
            "SELECT
                COALESCE(
                    SUM(avg_download_bps * sample_count) / NULLIF(SUM(sample_count), 0),
                    0.0
                ),
                COALESCE(
                    SUM(avg_upload_bps * sample_count) / NULLIF(SUM(sample_count), 0),
                    0.0
                ),
                COALESCE(MAX(peak_download_bps), 0.0),
                COALESCE(MAX(peak_upload_bps),   0.0),
                COALESCE(SUM(total_download_bytes), 0),
                COALESCE(SUM(total_upload_bytes),   0),
                COALESCE(SUM(sample_count), 0)
             FROM hourly_usage
             WHERE hour_start >= ?1 AND hour_start < ?2",
            [day_start_ts, day_end],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        )
        .unwrap_or((0.0, 0.0, 0.0, 0.0, 0, 0, 0));

    let (
        hourly_avg_dl,
        hourly_avg_ul,
        hourly_peak_dl,
        hourly_peak_ul,
        hourly_total_dl,
        hourly_total_ul,
        hourly_sample_count,
    ) = hourly_result;

    // ── Part 2: Sum raw samples from the current incomplete hour ──────────────
    // These samples haven't been rolled up into hourly_usage yet.
    // Only include if the current hour falls within this day.
    let (
        live_total_dl,
        live_total_ul,
        live_peak_dl,
        live_peak_ul,
        live_avg_dl,
        live_avg_ul,
        live_count,
    ): (i64, i64, f64, f64, f64, f64, i64) =
        if current_hour_start >= day_start_ts && current_hour_start < day_end {
            conn.query_row(
                "SELECT
                    COALESCE(CAST(SUM(download_bps) * ?3 AS INTEGER), 0),
                    COALESCE(CAST(SUM(upload_bps)   * ?3 AS INTEGER), 0),
                    COALESCE(MAX(download_bps), 0.0),
                    COALESCE(MAX(upload_bps),   0.0),
                    COALESCE(AVG(download_bps), 0.0),
                    COALESCE(AVG(upload_bps),   0.0),
                    COUNT(*)
                 FROM bandwidth_samples
                 WHERE timestamp >= ?1 AND timestamp < ?2",
                rusqlite::params![current_hour_start, day_end, SAMPLE_DURATION_SECS],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                    ))
                },
            )
            .unwrap_or((0, 0, 0.0, 0.0, 0.0, 0.0, 0))
        } else {
            (0, 0, 0.0, 0.0, 0.0, 0.0, 0)
        };

    // ── Part 3: Combine hourly + live ────────────────────────────────────────
    let total_sample_count = hourly_sample_count + live_count;

    if total_sample_count == 0 {
        // No data at all — try pure raw fallback for the entire day
        // (covers edge case where no hourly rollups exist AND current_hour check missed)
        let raw_result: rusqlite::Result<(i64, f64, f64, f64, f64, f64, f64)> = conn.query_row(
            "SELECT
                COUNT(*),
                COALESCE(AVG(download_bps), 0.0),
                COALESCE(AVG(upload_bps),   0.0),
                COALESCE(MAX(download_bps), 0.0),
                COALESCE(MAX(upload_bps),   0.0),
                COALESCE(SUM(download_bps), 0.0),
                COALESCE(SUM(upload_bps),   0.0)
             FROM bandwidth_samples
             WHERE timestamp >= ?1 AND timestamp < ?2",
            [day_start_ts, day_end],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        );

        if let Ok((count, avg_dl, avg_ul, peak_dl, peak_ul, sum_dl, sum_ul)) = raw_result {
            if count > 0 {
                let total_download_bytes = (sum_dl * SAMPLE_DURATION_SECS) as i64;
                let total_upload_bytes = (sum_ul * SAMPLE_DURATION_SECS) as i64;
                return upsert_daily(
                    conn,
                    &DailyUsage {
                        day: day_str.to_string(),
                        avg_download_bps: avg_dl,
                        avg_upload_bps: avg_ul,
                        peak_download_bps: peak_dl,
                        peak_upload_bps: peak_ul,
                        total_download_bytes,
                        total_upload_bytes,
                    },
                );
            }
        }
        return Ok(());
    }

    // Combine totals
    let combined_total_dl = hourly_total_dl + live_total_dl;
    let combined_total_ul = hourly_total_ul + live_total_ul;

    // Combined peaks = max of hourly peaks and live peaks
    let combined_peak_dl = hourly_peak_dl.max(live_peak_dl);
    let combined_peak_ul = hourly_peak_ul.max(live_peak_ul);

    // Weighted average across hourly + live samples
    let combined_avg_dl = if total_sample_count > 0 {
        (hourly_avg_dl * hourly_sample_count as f64 + live_avg_dl * live_count as f64)
            / total_sample_count as f64
    } else {
        0.0
    };
    let combined_avg_ul = if total_sample_count > 0 {
        (hourly_avg_ul * hourly_sample_count as f64 + live_avg_ul * live_count as f64)
            / total_sample_count as f64
    } else {
        0.0
    };

    upsert_daily(
        conn,
        &DailyUsage {
            day: day_str.to_string(),
            avg_download_bps: combined_avg_dl,
            avg_upload_bps: combined_avg_ul,
            peak_download_bps: combined_peak_dl,
            peak_upload_bps: combined_peak_ul,
            total_download_bytes: combined_total_dl,
            total_upload_bytes: combined_total_ul,
        },
    )
}

pub fn rollup_daily(conn: &Connection, day: DateTime<Local>) -> rusqlite::Result<()> {
    let day_str = day.format("%Y-%m-%d").to_string();
    let day_start = Local
        .with_ymd_and_hms(day.year(), day.month(), day.day(), 0, 0, 0)
        .unwrap()
        .timestamp();

    rollup_daily_at(conn, day_start, &day_str)
}

/// Roll up daily rows for *last* month into `monthly_usage`.
pub fn rollup_monthly(conn: &Connection, now: DateTime<Local>) -> rusqlite::Result<()> {
    let first_of_this_month = Local
        .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .unwrap();
    let last_month = first_of_this_month - chrono::Duration::days(1);
    let month_str = last_month.format("%Y-%m").to_string();
    rollup_monthly_for(conn, &month_str)
}

/// Rollup monthly for a specific month string (used by backfill).
pub fn rollup_monthly_for(conn: &Connection, month_str: &str) -> rusqlite::Result<()> {
    let like_prefix = format!("{}%", month_str);

    let result: rusqlite::Result<(i64, i64, f64, f64, i64)> = conn.query_row(
        "SELECT
             COALESCE(SUM(total_download_bytes), 0),
             COALESCE(SUM(total_upload_bytes),   0),
             COALESCE(MAX(peak_download_bps),    0.0),
             COALESCE(MAX(peak_upload_bps),      0.0),
             COUNT(*)
         FROM daily_usage
         WHERE day LIKE ?1",
        rusqlite::params![like_prefix],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    );

    if let Ok((total_dl, total_ul, peak_dl, peak_ul, count)) = result {
        if count > 0 {
            upsert_monthly(
                conn,
                &MonthlyUsage {
                    month: month_str.to_string(),
                    total_download_bytes: total_dl,
                    total_upload_bytes: total_ul,
                    peak_download_bps: peak_dl,
                    peak_upload_bps: peak_ul,
                },
            )?;
        }
    }

    Ok(())
}
