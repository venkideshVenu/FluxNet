use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::AppHandle;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct StoredVisibility {
    #[serde(default = "default_true")]
    pub visible: bool,
}

fn default_true() -> bool { true }

impl Default for StoredVisibility {
    fn default() -> Self { Self { visible: true } }
}

pub type VisibilityMap = BTreeMap<String, StoredVisibility>;
pub type VisibilityStore = PersistentStore<VisibilityMap>;

/// Save visibility for a widget. The store is retrieved from Tauri state.
pub fn save_widget_visibility(
    store: &VisibilityStore,
    app: &AppHandle,
    label: &str,
    visible: bool,
) {
    if !matches!(label, "pill" | "compact" | "hud") {
        tracing::warn!("save_widget_visibility: unknown label '{label}'");
        return;
    }
    store.update(app, |map| {
        map.insert(label.to_string(), StoredVisibility { visible });
    });
}