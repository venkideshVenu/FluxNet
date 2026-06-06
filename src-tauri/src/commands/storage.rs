use tauri::State;

use crate::storage::{
    db::ReadOnlyDb,
    repository::{
        get_daily_last_n, get_hourly_since, get_monthly_all, get_samples_since, get_usage_stats,
        BandwidthSample, DailyUsage, HourlyUsage, MonthlyUsage, UsageStats,
    },
};

use chrono::{Duration, Local};
/// Summary card data: today / week / month totals plus all-time peaks.
/// Refreshed by the frontend every 30 s.
#[tauri::command]
pub fn get_usage_stats_cmd(db: State<ReadOnlyDb>) -> Result<UsageStats, String> {
    let conn = db.0.lock();
    get_usage_stats(&conn).map_err(|e| e.to_string())
}

/// Raw 500 ms samples for the last `minutes` minutes (default 60 if omitted).
/// Used by the live history chart on HistoryPage.
#[tauri::command]
pub fn get_history_range(
    db: State<ReadOnlyDb>,
    minutes: Option<i64>,
) -> Result<Vec<BandwidthSample>, String> {
    let conn = db.0.lock();
    let since = (Local::now() - Duration::minutes(minutes.unwrap_or(60))).timestamp();
    get_samples_since(&conn, since).map_err(|e| e.to_string())
}

/// Hourly averages/peaks for the last `hours` hours (default 48).
/// Used by the "Last 48 h" chart tab.
#[tauri::command]
pub fn get_hourly_summary(
    db: State<ReadOnlyDb>,
    hours: Option<i64>,
) -> Result<Vec<HourlyUsage>, String> {
    let conn = db.0.lock();
    let since = (Local::now() - Duration::hours(hours.unwrap_or(48))).timestamp();
    get_hourly_since(&conn, since).map_err(|e| e.to_string())
}

/// Most-recent `days` daily rows (default 30), in ascending date order.
/// Used by the "Last 30 days" bar chart.
#[tauri::command]
pub fn get_daily_summary(
    db: State<ReadOnlyDb>,
    days: Option<i64>,
) -> Result<Vec<DailyUsage>, String> {
    let conn = db.0.lock();
    get_daily_last_n(&conn, days.unwrap_or(30)).map_err(|e| e.to_string())
}

/// All monthly rows in ascending order.
/// Used by the monthly overview tab.
#[tauri::command]
pub fn get_monthly_summary(db: State<ReadOnlyDb>) -> Result<Vec<MonthlyUsage>, String> {
    let conn = db.0.lock();
    get_monthly_all(&conn).map_err(|e| e.to_string())
}
