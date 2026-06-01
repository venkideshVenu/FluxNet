use tauri::{AppHandle, Manager};

use crate::window_visibility::save_widget_visibility;

/// Show or hide a widget window by label and persist the new state to disk.
///
/// Called from the frontend (React) whenever the user toggles a widget
/// from the Settings or Dashboard page.
///
/// Accepted labels: "pill" | "compact" | "hud"
/// Any other label is silently ignored.
#[tauri::command]
pub fn set_widget_visibility(label: String, visible: bool, app: AppHandle) -> Result<(), String> {
    if !matches!(label.as_str(), "pill" | "compact" | "hud") {
        // Silently succeed for unknown labels — callers don't need to handle this.
        return Ok(());
    }

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("{label} window not found"))?;

    if visible {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }

    // Persist immediately so the next launch restores the correct state.
    save_widget_visibility(&app, &label, visible);

    Ok(())
}
