use tauri::{AppHandle, Manager};

use crate::storage::{
    db::ReadOnlyDb,
    repository::{
        BandwidthSample, DailyUsage, HourlyUsage, MonthlyUsage, UsageStats, get_daily_last_n,
        get_hourly_since, get_monthly_all, get_samples_since, get_usage_stats,
    },
};

use chrono::{Duration, Local};

#[tauri::command]
pub fn get_usage_stats_cmd(app: AppHandle) -> Result<UsageStats, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_usage_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history_range(
    app: AppHandle,
    minutes: Option<i64>,
) -> Result<Vec<BandwidthSample>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    let since = (Local::now() - Duration::minutes(minutes.unwrap_or(60))).timestamp();
    get_samples_since(&conn, since).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_hourly_summary(app: AppHandle, hours: Option<i64>) -> Result<Vec<HourlyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    let since = (Local::now() - Duration::hours(hours.unwrap_or(48))).timestamp();
    get_hourly_since(&conn, since).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_daily_summary(app: AppHandle, days: Option<i64>) -> Result<Vec<DailyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_daily_last_n(&conn, days.unwrap_or(30)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_monthly_summary(app: AppHandle) -> Result<Vec<MonthlyUsage>, String> {
    let db = app
        .try_state::<ReadOnlyDb>()
        .ok_or_else(|| "Database not yet initialized".to_string())?;
    let conn = db.0.lock();
    get_monthly_all(&conn).map_err(|e| e.to_string())
}
