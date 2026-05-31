use chrono::{Datelike, Local, TimeZone, Timelike};
use rusqlite::Connection;

use crate::storage::repository::{
    get_samples_since, upsert_daily, upsert_hourly, upsert_monthly, DailyUsage, HourlyUsage,
    MonthlyUsage,
};

/// Roll up raw samples from the most recently *completed* hour into `hourly_usage`.
///
/// Called from `main.rs` once when the clock hour changes (e.g. 13:59 → 14:00).
/// Uses an UPSERT so re-running is always safe.
pub fn rollup_hourly(conn: &Connection) -> rusqlite::Result<()> {
    let now = Local::now();

    // Start of the hour that just completed (one hour before the current one).
    let current_hour_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), now.hour(), 0, 0)
        .unwrap()
        .timestamp();
    let hour_start = current_hour_start - 3600;
    let hour_end = current_hour_start;

    // Pull raw samples that fall inside [hour_start, hour_end).
    let all_samples = get_samples_since(conn, hour_start)?;
    let samples: Vec<_> = all_samples
        .into_iter()
        .filter(|s| s.timestamp < hour_end)
        .collect();

    if samples.is_empty() {
        return Ok(());
    }

    let count = samples.len() as i64;
    let avg_dl = samples.iter().map(|s| s.download_bps).sum::<f64>() / count as f64;
    let avg_ul = samples.iter().map(|s| s.upload_bps).sum::<f64>() / count as f64;
    let peak_dl = samples
        .iter()
        .map(|s| s.download_bps)
        .fold(f64::NEG_INFINITY, f64::max);
    let peak_ul = samples
        .iter()
        .map(|s| s.upload_bps)
        .fold(f64::NEG_INFINITY, f64::max);

    // Each sample spans ~0.5 s (500 ms poll interval).
    // total_bytes ≈ avg_bps × 3600 s (one full hour).
    let total_dl = (avg_dl * 3600.0) as i64;
    let total_ul = (avg_ul * 3600.0) as i64;

    upsert_hourly(
        conn,
        &HourlyUsage {
            hour_start,
            avg_download_bps: avg_dl,
            avg_upload_bps: avg_ul,
            peak_download_bps: peak_dl,
            peak_upload_bps: peak_ul,
            total_download_bytes: total_dl,
            total_upload_bytes: total_ul,
            sample_count: count,
        },
    )
}

/// Roll up hourly rows for *yesterday* into `daily_usage`.
///
/// Called from `main.rs` once when the calendar day changes (midnight crossing).
pub fn rollup_daily(conn: &Connection) -> rusqlite::Result<()> {
    let yesterday = Local::now() - chrono::Duration::days(1);
    let day_str = yesterday.format("%Y-%m-%d").to_string();

    let day_start = Local
        .with_ymd_and_hms(
            yesterday.year(),
            yesterday.month(),
            yesterday.day(),
            0,
            0,
            0,
        )
        .unwrap()
        .timestamp();
    let day_end = day_start + 86_400;

    // Aggregate from hourly_usage rows that belong to yesterday.
    let result: rusqlite::Result<(f64, f64, f64, f64, i64, i64, i64)> = conn.query_row(
        "SELECT AVG(avg_download_bps),
                AVG(avg_upload_bps),
                MAX(peak_download_bps),
                MAX(peak_upload_bps),
                SUM(total_download_bytes),
                SUM(total_upload_bytes),
                COUNT(*)
         FROM hourly_usage
         WHERE hour_start >= ?1 AND hour_start < ?2",
        rusqlite::params![day_start, day_end],
        |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
            ))
        },
    );

    if let Ok((avg_dl, avg_ul, peak_dl, peak_ul, total_dl, total_ul, count)) = result {
        if count > 0 {
            upsert_daily(
                conn,
                &DailyUsage {
                    day: day_str,
                    avg_download_bps: avg_dl,
                    avg_upload_bps: avg_ul,
                    peak_download_bps: peak_dl,
                    peak_upload_bps: peak_ul,
                    total_download_bytes: total_dl,
                    total_upload_bytes: total_ul,
                },
            )?;
        }
    }

    Ok(())
}

/// Roll up daily rows for *last month* into `monthly_usage`.
///
/// Called from `main.rs` on the first day of a new month.
pub fn rollup_monthly(conn: &Connection) -> rusqlite::Result<()> {
    // "Last month" = any point 32+ days ago guarantees we're in the previous month.
    let last_month = Local::now() - chrono::Duration::days(32);
    let month_str = last_month.format("%Y-%m").to_string();
    let like_prefix = format!("{}%", month_str);

    let result: rusqlite::Result<(i64, i64, f64, f64, i64)> = conn.query_row(
        "SELECT SUM(total_download_bytes),
                SUM(total_upload_bytes),
                MAX(peak_download_bps),
                MAX(peak_upload_bps),
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
