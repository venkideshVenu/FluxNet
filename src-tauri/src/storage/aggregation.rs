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
    let hour_end = current_hour_start;

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
            row.get::<_, i64>(0)?, // sample_count
            row.get::<_, f64>(1)?, // avg_download_bps
            row.get::<_, f64>(2)?, // avg_upload_bps
            row.get::<_, f64>(3)?, // peak_download_bps
            row.get::<_, f64>(4)?, // peak_upload_bps
            row.get::<_, f64>(5)?, // sum_download_bps
            row.get::<_, f64>(6)?, // sum_upload_bps
        ))
    })?;

    let (count, avg_dl, avg_ul, peak_dl, peak_ul, sum_dl, sum_ul) = row;

    if count == 0 {
        return Ok(());
    }

    // Total bytes = SUM(rate) × sample_duration
    // Each sample's bps value represents the rate over ~500ms.
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

/// Rollup daily for a specific day string (used by backfill).
pub fn rollup_daily_at(
    conn: &Connection,
    day_start_ts: i64,
    day_str: &str,
) -> rusqlite::Result<()> {
    let day_end = day_start_ts + 86_400;

    // First try from hourly_usage (preferred — already aggregated)
    let from_hourly: rusqlite::Result<(f64, f64, f64, f64, i64, i64, i64)> = conn.query_row(
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
            COUNT(*)
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
    );

    if let Ok((avg_dl, avg_ul, peak_dl, peak_ul, total_dl, total_ul, count)) = from_hourly {
        if count > 0 {
            return upsert_daily(
                conn,
                &DailyUsage {
                    day: day_str.to_string(),
                    avg_download_bps: avg_dl,
                    avg_upload_bps: avg_ul,
                    peak_download_bps: peak_dl,
                    peak_upload_bps: peak_ul,
                    total_download_bytes: total_dl,
                    total_upload_bytes: total_ul,
                },
            );
        }
    }

    // Fallback: compute directly from raw samples
    let from_raw: rusqlite::Result<(i64, f64, f64, f64, f64, f64, f64)> = conn.query_row(
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

    if let Ok((count, avg_dl, avg_ul, peak_dl, peak_ul, sum_dl, sum_ul)) = from_raw {
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

    Ok(())
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
                    month: month_str,
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
