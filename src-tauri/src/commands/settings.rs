use crate::persistence::app_settings::SettingsStore;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn get_ping_target(_app: AppHandle) -> Result<String, String> {
    Ok("1.1.1.1".to_string())
}

#[tauri::command]
pub fn set_ping_target(_app: AppHandle, _target: String) -> Result<(), String> {
    // No-op: ping target is hardcoded to 1.1.1.1
    Ok(())
}

#[tauri::command]
pub fn get_refresh_interval(app: AppHandle) -> Result<u32, String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    Ok(store.read(|s| s.clamped_refresh_interval_ms()))
}

#[tauri::command]
pub fn set_refresh_interval(app: AppHandle, interval_ms: u32) -> Result<(), String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    if !(500..=5_000).contains(&interval_ms) {
        return Err(format!(
            "refresh_interval_ms must be between 500 and 5000, got {interval_ms}"
        ));
    }
    store.update(&app, |s| s.refresh_interval_ms = interval_ms);
    Ok(())
}

#[tauri::command]
pub fn get_onboarding_completed(app: AppHandle) -> Result<bool, String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    Ok(store.read(|s| s.onboarding_completed))
}

#[tauri::command]
pub fn set_onboarding_completed(app: AppHandle) -> Result<(), String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    store.update(&app, |s| s.onboarding_completed = true);
    Ok(())
}

#[tauri::command]
pub fn get_minimize_to_tray(app: AppHandle) -> Result<bool, String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    Ok(store.read(|s| s.minimize_to_tray))
}

#[tauri::command]
pub fn set_minimize_to_tray(app: AppHandle, enabled: bool) -> Result<(), String> {
    let store = app
        .try_state::<Arc<SettingsStore>>()
        .ok_or_else(|| "Settings not yet initialized".to_string())?;
    store.update(&app, |s| s.minimize_to_tray = enabled);
    Ok(())
}
