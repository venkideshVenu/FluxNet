use tauri::State;

use crate::storage::{
    repository::{
        get_daily_last_n, get_hourly_since, get_monthly_all, get_samples_since, get_usage_stats,
        BandwidthSample, DailyUsage, HourlyUsage, MonthlyUsage, UsageStats,
    },
    DbState,
};

use chrono::{Duration, Local};

/// Quick summary card data (today / week / month totals + all-time peaks).
#[tauri::command]
pub fn get_usage_stats_cmd(db: State<DbState>) -> Result<UsageStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    get_usage_stats(&conn).map_err(|e| e.to_string())
}

/// Raw samples for the last `minutes` minutes. Default: 60.
#[tauri::command]
pub fn get_history_range(
    db: State<DbState>,
    minutes: Option<i64>,
) -> Result<Vec<BandwidthSample>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let since = (Local::now() - Duration::minutes(minutes.unwrap_or(60))).timestamp();
    get_samples_since(&conn, since).map_err(|e| e.to_string())
}

/// Hourly rows for the last `hours` hours. Default: 24.
#[tauri::command]
pub fn get_hourly_summary(
    db: State<DbState>,
    hours: Option<i64>,
) -> Result<Vec<HourlyUsage>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let since = (Local::now() - Duration::hours(hours.unwrap_or(24))).timestamp();
    get_hourly_since(&conn, since).map_err(|e| e.to_string())
}

/// Last `days` daily rows. Default: 30.
#[tauri::command]
pub fn get_daily_summary(db: State<DbState>, days: Option<i64>) -> Result<Vec<DailyUsage>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    get_daily_last_n(&conn, days.unwrap_or(30)).map_err(|e| e.to_string())
}

/// All monthly rows.
#[tauri::command]
pub fn get_monthly_summary(db: State<DbState>) -> Result<Vec<MonthlyUsage>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    get_monthly_all(&conn).map_err(|e| e.to_string())
}
