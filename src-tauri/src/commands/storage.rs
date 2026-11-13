use tauri::{AppHandle, Manager};

use crate::storage::{
    db::ReadOnlyDb,
    repository::{
        BandwidthSample, DailyUsage, HourlyUsage, MonthlyUsage, UsageStats, get_daily_last_n,
        get_hourly_since, get_monthly_all, get_samples_since, get_usage_stats,
    },
};

use chrono::{Duration, Local};

/// Raw samples are kept for 7 days.
const MAX_RAW_MINUTES: i64 = 7 * 24 * 60;
/// Hourly rows are kept indefinitely; cap a single request at ~1 year.
const MAX_HOURS: i64 = 366 * 24;
const MAX_DAYS: i64 = 10 * 366;

// `async`: these run on the async runtime's thread pool instead of the main
// thread, so a slow query can't freeze every window.
#[tauri::command(async)]
pub fn get_usage_stats_cmd(app: AppHandle) -> Result<UsageStats, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_usage_stats(&conn).map_err(|e| e.to_string())
}

// `async`: these run on the async runtime's thread pool instead of the main
// thread, so a slow query can't freeze every window.
#[tauri::command(async)]
pub fn get_history_range(
    app: AppHandle,
    minutes: Option<i64>,
) -> Result<Vec<BandwidthSample>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    let since = (Local::now() - Duration::minutes(minutes.unwrap_or(60).clamp(1, MAX_RAW_MINUTES)))
        .timestamp();
    get_samples_since(&conn, since).map_err(|e| e.to_string())
}

// `async`: these run on the async runtime's thread pool instead of the main
// thread, so a slow query can't freeze every window.
#[tauri::command(async)]
pub fn get_hourly_summary(app: AppHandle, hours: Option<i64>) -> Result<Vec<HourlyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    let since =
        (Local::now() - Duration::hours(hours.unwrap_or(48).clamp(1, MAX_HOURS))).timestamp();
    get_hourly_since(&conn, since).map_err(|e| e.to_string())
}

// `async`: these run on the async runtime's thread pool instead of the main
// thread, so a slow query can't freeze every window.
#[tauri::command(async)]
pub fn get_daily_summary(app: AppHandle, days: Option<i64>) -> Result<Vec<DailyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_daily_last_n(&conn, days.unwrap_or(30).clamp(1, MAX_DAYS)).map_err(|e| e.to_string())
}

// `async`: these run on the async runtime's thread pool instead of the main
// thread, so a slow query can't freeze every window.
#[tauri::command(async)]
pub fn get_monthly_summary(app: AppHandle) -> Result<Vec<MonthlyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_monthly_all(&conn).map_err(|e| e.to_string())
}
