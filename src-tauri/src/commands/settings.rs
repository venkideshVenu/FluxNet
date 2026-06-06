use crate::persistence::app_settings::SettingsStore;
use std::net::IpAddr;
use std::sync::Arc;
use tauri::State;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Accept a value if it parses as an IP address OR looks like a plausible hostname.
/// This is intentionally lenient — detailed DNS validation is the OS's job.
fn is_valid_ping_target(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    // IP address — strict
    if s.parse::<IpAddr>().is_ok() {
        return true;
    }
    // Hostname heuristic: printable ASCII, no spaces, ≤253 chars, no forbidden chars
    if s.len() > 253 {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

// ── Commands ──────────────────────────────────────────────────────────────────

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

#[tauri::command]
pub fn set_refresh_interval(
    store: State<Arc<SettingsStore>>,
    interval_ms: u32,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if !(100..=5_000).contains(&interval_ms) {
        return Err(format!(
            "refresh_interval_ms must be between 100 and 5000, got {interval_ms}"
        ));
    }
    store.update(&app, |s| s.refresh_interval_ms = interval_ms);
    Ok(())
}
