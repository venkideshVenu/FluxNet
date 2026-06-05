use crate::persistence::app_settings::{SettingsStore};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_ping_target(store: State<Arc<SettingsStore>>) -> Result<String, String> {
    let settings = store.read(|s| s.clone());
    Ok(settings.ping_target)
}

#[tauri::command]
pub fn set_ping_target(store: State<Arc<SettingsStore>>, target: String, app: tauri::AppHandle) -> Result<(), String> {
    // Basic validation – IP address or hostname
    if target.trim().is_empty() {
        return Err("Ping target cannot be empty".to_string());
    }
    store.update(&app, |s| s.ping_target = target);
    Ok(())
}