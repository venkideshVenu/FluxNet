use crate::persistence::app_settings::SettingsStore;
use std::net::IpAddr;
use std::sync::Arc;
use tauri::State;

fn is_valid_ping_target(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    if s.parse::<IpAddr>().is_ok() {
        return true;
    }
    if s.len() > 253 {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

#[tauri::command]
pub fn get_ping_target(store: State<Arc<SettingsStore>>) -> Result<String, String> {
    Ok(store.read(|s| s.ping_target.clone()))
}

#[tauri::command]
pub fn set_ping_target(
    store: State<Arc<SettingsStore>>,
    target: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let trimmed = target.trim().to_string();
    if !is_valid_ping_target(&trimmed) {
        return Err(format!(
            "'{trimmed}' is not a valid IP address or hostname."
        ));
    }
    store.update(&app, |s| s.ping_target = trimmed);
    Ok(())
}

#[tauri::command]
pub fn get_refresh_interval(store: State<Arc<SettingsStore>>) -> Result<u32, String> {
    Ok(store.read(|s| s.clamped_refresh_interval_ms()))
}

/// Persists the user's preferred display refresh interval.
/// NOTE: This does NOT change the backend sampling rate (always 500ms).
/// It only affects how often the frontend polls for updated data.
#[tauri::command]
pub fn set_refresh_interval(
    store: State<Arc<SettingsStore>>,
    interval_ms: u32,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if !(500..=5_000).contains(&interval_ms) {
        return Err(format!(
            "refresh_interval_ms must be between 500 and 5000, got {interval_ms}"
        ));
    }
    store.update(&app, |s| s.refresh_interval_ms = interval_ms);
    Ok(())
}

#[tauri::command]
pub fn get_onboarding_completed(store: State<Arc<SettingsStore>>) -> Result<bool, String> {
    Ok(store.read(|s| s.onboarding_completed))
}

#[tauri::command]
pub fn set_onboarding_completed(
    store: State<Arc<SettingsStore>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    store.update(&app, |s| s.onboarding_completed = true);
    Ok(())
}

// The main.rs on_window_event handler should read this setting when
// CloseRequested fires to decide whether to hide or quit.

#[tauri::command]
pub fn get_minimize_to_tray(store: State<Arc<SettingsStore>>) -> Result<bool, String> {
    Ok(store.read(|s| s.minimize_to_tray))
}

#[tauri::command]
pub fn set_minimize_to_tray(
    store: State<Arc<SettingsStore>>,
    enabled: bool,
    app: tauri::AppHandle,
) -> Result<(), String> {
    store.update(&app, |s| s.minimize_to_tray = enabled);
    Ok(())
}
