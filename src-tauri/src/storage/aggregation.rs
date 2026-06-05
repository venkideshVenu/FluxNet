use chrono::{DateTime, Datelike, Local, TimeZone, Timelike};
use rusqlite::Connection;

use crate::storage::repository::{
    upsert_daily, upsert_hourly, upsert_monthly, DailyUsage, HourlyUsage, MonthlyUsage,
};

pub fn rollup_hourly(conn: &Connection, now: DateTime<Local>) -> rusqlite::Result<()> {
    let now = now;

    // Start of the hour that just completed (one hour before the current one)
    let current_hour_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), now.hour(), 0, 0)
        .unwrap()
        .timestamp();
    let hour_start = current_hour_start - 3600;
    let hour_end = current_hour_start;

    // Single query: compute all needed aggregates using LAG to get real elapsed seconds
    let mut stmt = conn.prepare(
        r#"
        WITH time_deltas AS (
            SELECT
                download_bps,
                upload_bps,
                timestamp - LAG(timestamp) OVER (ORDER BY timestamp) AS delta_secs
            FROM bandwidth_samples
            WHERE timestamp >= ?1 AND timestamp < ?2
        )
        SELECT
            COALESCE(SUM(download_bps * delta_secs), 0) AS total_download_bytes,
            COALESCE(SUM(upload_bps   * delta_secs), 0) AS total_upload_bytes,
            COUNT(*) AS sample_count,
            COALESCE(AVG(download_bps), 0.0) AS avg_download_bps,
            COALESCE(AVG(upload_bps),   0.0) AS avg_upload_bps,
            COALESCE(MAX(download_bps), 0.0) AS peak_download_bps,
            COALESCE(MAX(upload_bps),   0.0) AS peak_upload_bps
        FROM time_deltas
        "#,
    )?;

    let row = stmt.query_row([hour_start, hour_end], |row| {
        Ok((
            row.get::<_, i64>(0)?, // total_download_bytes
            row.get::<_, i64>(1)?, // total_upload_bytes
            row.get::<_, i64>(2)?, // sample_count
            row.get::<_, f64>(3)?, // avg_download_bps
            row.get::<_, f64>(4)?, // avg_upload_bps
            row.get::<_, f64>(5)?, // peak_download_bps
            row.get::<_, f64>(6)?, // peak_upload_bps
        ))
    })?;

    let (total_dl, total_ul, count, avg_dl, avg_ul, peak_dl, peak_ul) = row;

    if count == 0 {
        return Ok(());
    }

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

pub fn rollup_daily(conn: &Connection, now: DateTime<Local>) -> rusqlite::Result<()> {
    let yesterday = now;
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

    // Weighted averages: SUM(avg * sample_count) / SUM(sample_count)
    let mut stmt = conn.prepare(
        r#"
        SELECT
            COALESCE(SUM(avg_download_bps * sample_count) / NULLIF(SUM(sample_count), 0), 0.0) AS weighted_avg_dl,
            COALESCE(SUM(avg_upload_bps   * sample_count) / NULLIF(SUM(sample_count), 0), 0.0) AS weighted_avg_ul,
            MAX(peak_download_bps),
            MAX(peak_upload_bps),
            SUM(total_download_bytes),
            SUM(total_upload_bytes),
            COUNT(*)
        FROM hourly_usage
        WHERE hour_start >= ?1 AND hour_start < ?2
        "#,
    )?;

    let row = stmt.query_row([day_start, day_end], |row| {
        Ok((
            row.get::<_, f64>(0)?, // avg_download_bps
            row.get::<_, f64>(1)?, // avg_upload_bps
            row.get::<_, f64>(2)?, // peak_download_bps
            row.get::<_, f64>(3)?, // peak_upload_bps
            row.get::<_, i64>(4)?, // total_download_bytes
            row.get::<_, i64>(5)?, // total_upload_bytes
            row.get::<_, i64>(6)?, // sample_count
        ))
    })?;

    let (avg_dl, avg_ul, peak_dl, peak_ul, total_dl, total_ul, count) = row;

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

    Ok(())
}

/// Roll up daily rows for *last month* into `monthly_usage`.
///
/// Called from `main.rs` on the first day of a new month.
pub fn rollup_monthly(conn: &Connection, now: DateTime<Local>) -> rusqlite::Result<()> {
    // Go to the first day of this month, then step back one day into last month.
    let now = now;
    let first_of_this_month = Local
        .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .unwrap();
    let last_month = first_of_this_month - chrono::Duration::days(1);
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
