use crate::app_windows::{self, lock_logical_size};
use crate::commands::network::is_widget_label;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub type WidgetStore = PersistentStore<WidgetState>;

// ── Window size constants ─────────────────────────────────────────────────────

/// Horizontal HUD: widened from 320→380 so the LOSS column is always visible.
const HUD_HORIZONTAL_W: f64 = 300.0;
const HUD_HORIZONTAL_H: f64 = 36.0;

/// Vertical HUD: enlarged from 130×105→150×130 for readable font sizes.
const HUD_VERTICAL_W: f64 = 120.0;
const HUD_VERTICAL_H: f64 = 130.0;

pub fn hud_size_for_design(design: &str) -> (f64, f64) {
    if design == "vertical" {
        (HUD_VERTICAL_W, HUD_VERTICAL_H)
    } else {
        (HUD_HORIZONTAL_W, HUD_HORIZONTAL_H)
    }
}

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
    // Persist first so the Destroyed handler and this call agree.
    store.update(app, |state| state.set_visibility(label, visible));
    if visible {
        let window = app_windows::get_or_create(app, label)?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        // Destroy rather than hide so the widget's webview memory is freed.
        app_windows::destroy_widget(app, label)?;
    }
    app_windows::emit_widget_visibility(app, label, visible);
    Ok(())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Async because creating a window from a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn set_widget_visibility(
    label: String,
    visible: bool,
    app: AppHandle,
) -> Result<(), String> {
    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    apply_widget_visibility(&app, &store, &label, visible)
}

/// Persisted on/off state of a widget (the source of truth for the dashboard).
#[tauri::command]
pub fn get_widget_visibility(label: String, app: AppHandle) -> Result<bool, String> {
    if !is_widget_label(&label) {
        return Err(format!("unknown window label: {label}"));
    }
    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    Ok(store.read(|state| state.get_config(&label).visible))
}

#[tauri::command]
pub fn set_widget_always_on_top(label: String, value: bool, app: AppHandle) -> Result<(), String> {
    if !is_widget_label(&label) {
        return Err(format!("unknown window label: {label}"));
    }
    // The widget may not exist while it is turned off; the stored value is
    // applied when it is next created.
    if let Some(window) = app.get_webview_window(&label) {
        window.set_always_on_top(value).map_err(|e| e.to_string())?;
    }

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
    // A widget that is turned off has no window; it reads its stored opacity
    // when it is next created.
    let Some(window) = app.get_webview_window(&label) else {
        return Ok(());
    };
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity='{0}';document.body.style.opacity='{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hud_design(design: String, app: AppHandle) -> Result<(), String> {
    match design.as_str() {
        "horizontal" | "vertical" => {}
        _ => return Err(format!("invalid hud design: {design}")),
    }

    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    store.update(&app, |state| state.set_hud_design(&design));

    // If the HUD is off there is nothing to resize; it is created at the
    // stored design's size next time.
    let Some(window) = app.get_webview_window("hud") else {
        return Ok(());
    };
    let (w, h) = hud_size_for_design(&design);
    lock_logical_size(&window, w, h);

    let _ = window.eval(&format!(
        "window.__FLUXNET_HUD_DESIGN='{}';window.dispatchEvent(new Event('fluxnet_hud_design_changed'));",
        design
    ));

    Ok(())
}

#[tauri::command]
pub fn get_hud_design(app: AppHandle) -> Result<String, String> {
    let store = app
        .try_state::<Arc<WidgetStore>>()
        .ok_or_else(|| "Widget store not yet initialized".to_string())?;
    Ok(store.read(|state| state.get_hud_design().to_string()))
}
