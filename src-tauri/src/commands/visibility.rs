use tauri::{AppHandle, Manager};
use crate::window_visibility::{save_widget_visibility, VisibilityStore};
use std::sync::Arc;

pub fn apply_widget_visibility(
    app: &AppHandle,
    store: &VisibilityStore,
    label: &str,
    visible: bool,
) -> Result<(), String> {
    if !matches!(label, "pill" | "compact" | "hud") {
        return Ok(());
    }

    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window not found"))?;

    if visible {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }
    save_widget_visibility(store, app, label, visible);
    Ok(())
}

#[tauri::command]
pub fn set_widget_visibility(label: String, visible: bool, app: AppHandle) -> Result<(), String> {
    let store = app.state::<Arc<VisibilityStore>>();
    apply_widget_visibility(&app, &store, &label, visible)
}