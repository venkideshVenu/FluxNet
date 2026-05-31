use rusqlite::{params, Connection};
use serde::Serialize;

// ── Types returned to the frontend ───────────────────────────────────────────

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
    pub day: String,
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
    pub month: String,
    pub total_download_bytes: i64,
    pub total_upload_bytes: i64,
    pub peak_download_bps: f64,
    pub peak_upload_bps: f64,
}

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

// ── Write ─────────────────────────────────────────────────────────────────────

/// Insert a single raw bandwidth sample.
pub fn insert_sample(
    conn: &Connection,
    timestamp: i64,
    interface_name: &str,
    download_bps: f64,
    upload_bps: f64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO bandwidth_samples
             (timestamp, interface_name, download_bps, upload_bps)
         VALUES (?1, ?2, ?3, ?4)",
        params![timestamp, interface_name, download_bps, upload_bps],
    )?;
    Ok(())
}

/// Delete raw samples older than `cutoff_ts` (Unix seconds).
/// Call once per minute to keep the table at ≤ 7 days.
pub fn cleanup_old_samples(conn: &Connection, cutoff_ts: i64) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM bandwidth_samples WHERE timestamp < ?1",
        params![cutoff_ts],
    )?;
    Ok(())
}

// ── Aggregation writes ────────────────────────────────────────────────────────

pub fn upsert_hourly(conn: &Connection, usage: &HourlyUsage) -> rusqlite::Result<()> {
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
            usage.hour_start,
            usage.avg_download_bps,
            usage.avg_upload_bps,
            usage.peak_download_bps,
            usage.peak_upload_bps,
            usage.total_download_bytes,
            usage.total_upload_bytes,
            usage.sample_count,
        ],
    )?;
    Ok(())
}

pub fn upsert_daily(conn: &Connection, usage: &DailyUsage) -> rusqlite::Result<()> {
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
            usage.day,
            usage.avg_download_bps,
            usage.avg_upload_bps,
            usage.peak_download_bps,
            usage.peak_upload_bps,
            usage.total_download_bytes,
            usage.total_upload_bytes,
        ],
    )?;
    Ok(())
}

pub fn upsert_monthly(conn: &Connection, usage: &MonthlyUsage) -> rusqlite::Result<()> {
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
            usage.month,
            usage.total_download_bytes,
            usage.total_upload_bytes,
            usage.peak_download_bps,
            usage.peak_upload_bps,
        ],
    )?;
    Ok(())
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/// Raw samples for a time window — used by the live history chart.
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

/// Hourly rows for the last N hours — used for the hourly chart.
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

/// All daily rows — used for the 30-day overview.
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
    let mut rows: Vec<_> = rows.collect::<rusqlite::Result<_>>()?;
    rows.reverse(); // ascending for chart rendering
    Ok(rows)
}

/// All monthly rows.
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

/// Aggregate usage stats across today / this week / this month.
pub fn get_usage_stats(conn: &Connection) -> rusqlite::Result<UsageStats> {
    use chrono::{Datelike, Duration, Local, Timelike};
    let now = Local::now();
    let today_str = now.format("%Y-%m-%d").to_string();
    let month_str = now.format("%Y-%m").to_string();
    let week_ago = (now - Duration::days(7)).timestamp();
    let month_start = {
        let d = now.with_day(1).unwrap();
        d.with_hour(0)
            .unwrap()
            .with_minute(0)
            .unwrap()
            .with_second(0)
            .unwrap()
            .timestamp()
    };

    // Today from daily_usage (most accurate, written by aggregation engine)
    let today: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(total_download_bytes,0), COALESCE(total_upload_bytes,0)
             FROM daily_usage WHERE day = ?1",
            params![today_str],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    // Last 7 days from raw samples for accuracy
    let week: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(CAST(SUM(download_bps * 0.5) AS INTEGER), 0),
                    COALESCE(CAST(SUM(upload_bps   * 0.5) AS INTEGER), 0)
             FROM bandwidth_samples WHERE timestamp >= ?1",
            params![week_ago],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    // This calendar month from daily_usage
    let month: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(total_download_bytes),0),
                    COALESCE(SUM(total_upload_bytes),0)
             FROM daily_usage WHERE day LIKE ?1",
            params![format!("{}%", month_str)],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    // All-time session peaks (from hourly)
    let peaks: (f64, f64) = conn
        .query_row(
            "SELECT COALESCE(MAX(peak_download_bps),0.0),
                    COALESCE(MAX(peak_upload_bps),0.0)
             FROM hourly_usage",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0.0));

    let _ = month_start; // suppress unused warning if chrono path differs

    Ok(UsageStats {
        today_download_bytes: today.0,
        today_upload_bytes: today.1,
        week_download_bytes: week.0,
        week_upload_bytes: week.1,
        month_download_bytes: month.0,
        month_upload_bytes: month.1,
        peak_download_bps: peaks.0,
        peak_upload_bps: peaks.1,
    })
}
