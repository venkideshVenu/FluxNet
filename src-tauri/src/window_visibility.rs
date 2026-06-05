use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct StoredVisibility {
    #[serde(default = "default_true")]
    pub visible: bool,
}
fn default_true() -> bool {
    true
}
impl Default for StoredVisibility {
    fn default() -> Self {
        Self { visible: true }
    }
}

pub type VisibilityMap = BTreeMap<String, StoredVisibility>;
pub static STORE: PersistentStore<VisibilityMap> = PersistentStore::new("widget-visibility.json");

pub fn load_widget_visibility(app: &AppHandle) {
    STORE.load(app);
}

// Fixed function name (was apply_widget_visibilit)
pub fn apply_widget_visibility(app: &AppHandle) {
    let map = STORE.read(|m| m.clone());
    for label in ["pill", "compact", "hud"] {
        let Some(saved) = map.get(label).copied() else {
            continue;
        };
        if let Some(window) = app.get_webview_window(label) {
            if saved.visible {
                let _ = window.show();
            } else {
                let _ = window.hide();
            }
        }
    }
}

pub fn save_widget_visibility(app: &AppHandle, label: &str, visible: bool) {
    if !matches!(label, "pill" | "compact" | "hud") {
        tracing::warn!("save_widget_visibility: unknown label '{label}'");
        return;
    }
    STORE.update(app, |map| {
        map.insert(label.to_string(), StoredVisibility { visible });
    });
}
