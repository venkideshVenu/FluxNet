use tauri::{AppHandle, Manager};

use crate::window_visibility::save_widget_visibility;

pub fn apply_widget_visibility(app: &AppHandle, label: &str, visible: bool) -> Result<(), String> {
    if !matches!(label, "pill" | "compact" | "hud") {
        return Ok(());
    }

    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window not found"))?;

    if visible {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?; // only when user explicitly shows
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }
    save_widget_visibility(app, label, visible);
    Ok(())
}

#[tauri::command]
pub fn set_widget_visibility(label: String, visible: bool, app: AppHandle) -> Result<(), String> {
    apply_widget_visibility(&app, &label, visible)
}
