use crate::commands::network::is_widget_label;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub type WidgetStore = PersistentStore<WidgetState>;

// ── Internal helper ───────────────────────────────────────────────────────────

pub fn apply_widget_visibility(
    app: &AppHandle,
    store: &WidgetStore,
    label: &str,
    visible: bool,
) -> Result<(), String> {
    if !is_widget_label(label) {
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
    store.update(app, |state| state.set_visibility(label, visible));
    Ok(())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn set_widget_visibility(label: String, visible: bool, app: AppHandle) -> Result<(), String> {
    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    apply_widget_visibility(&app, &store, &label, visible)
}

#[tauri::command]
pub fn set_widget_always_on_top(label: String, value: bool, app: AppHandle) -> Result<(), String> {
    if !is_widget_label(&label) {
        return Err(format!("unknown window label: {label}"));
    }
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("{label} window not found"))?;
    window.set_always_on_top(value).map_err(|e| e.to_string())?;

    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    store.update(&app, |state| state.set_always_on_top(&label, value));
    Ok(())
}

#[tauri::command]
pub fn set_widget_opacity(label: String, value: f64, app: AppHandle) -> Result<(), String> {
    if !is_widget_label(&label) {
        return Err(format!("unknown window label: {label}"));
    }
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("{label} window not found"))?;
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity='{0}';document.body.style.opacity='{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}
