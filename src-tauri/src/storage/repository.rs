use chrono::{Datelike, Local};
use rusqlite::{params, Connection};
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

/// Insert one 500 ms raw bandwidth sample.
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
    // Collected in DESC order; reverse so charts get ascending dates.
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

/// Compute today / this-week / this-month totals plus all-time peaks.
/// Falls back gracefully to 0 if tables are still empty (first run).
pub fn get_usage_stats(conn: &Connection) -> rusqlite::Result<UsageStats> {
    let now = Local::now();
    let today_str = now.format("%Y-%m-%d").to_string();
    let month_str = now.format("%Y-%m").to_string();
    let week_ago = (now - chrono::Duration::days(7)).timestamp();

    // ── Today: read from daily_usage (written by the hourly rollup) ──────
    // Falls back to summing raw samples for the current calendar day so
    // the card is not empty until the first rollup fires.
    let today_start = {
        use chrono::TimeZone;
        Local
            .with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0)
            .unwrap()
            .timestamp()
    };

    let today: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(total_download_bytes, 0),
                    COALESCE(total_upload_bytes,   0)
             FROM daily_usage WHERE day = ?1",
            params![today_str],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or_else(|_| {
            // Fallback: estimate from raw samples for today only.
            conn.query_row(
                "SELECT COALESCE(CAST(SUM(download_bps * 0.5) AS INTEGER), 0),
                         COALESCE(CAST(SUM(upload_bps   * 0.5) AS INTEGER), 0)
                  FROM bandwidth_samples WHERE timestamp >= ?1",
                params![today_start],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap_or((0, 0))
        });

    // ── Last 7 days: from raw samples (high accuracy, within 7-day window) ─
    let week: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(CAST(SUM(download_bps * 0.5) AS INTEGER), 0),
                    COALESCE(CAST(SUM(upload_bps   * 0.5) AS INTEGER), 0)
             FROM bandwidth_samples WHERE timestamp >= ?1",
            params![week_ago],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    // ── This calendar month: sum daily_usage rows ─────────────────────────
    let month: (i64, i64) = conn
        .query_row(
            "SELECT COALESCE(SUM(total_download_bytes), 0),
                    COALESCE(SUM(total_upload_bytes),   0)
             FROM daily_usage WHERE day LIKE ?1",
            params![format!("{}%", month_str)],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0, 0));

    // ── All-time peaks: max across hourly_usage ───────────────────────────
    let peaks: (f64, f64) = conn
        .query_row(
            "SELECT COALESCE(MAX(peak_download_bps), 0.0),
                    COALESCE(MAX(peak_upload_bps),   0.0)
             FROM hourly_usage",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap_or((0.0, 0.0));

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
