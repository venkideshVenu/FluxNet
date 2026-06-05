use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub type WidgetStore = PersistentStore<WidgetState>;

pub fn apply_widget_visibility(
    app: &AppHandle,
    store: &WidgetStore,
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
    store.update(app, |state| state.set_visibility(label, visible));
    Ok(())
}

#[tauri::command]
pub fn set_widget_visibility(label: String, visible: bool, app: AppHandle) -> Result<(), String> {
    let store = app.state::<Arc<WidgetStore>>();
    apply_widget_visibility(&app, &store, &label, visible)
}
