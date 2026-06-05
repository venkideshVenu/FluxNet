use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::{AppHandle};

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


pub fn save_widget_visibility(app: &AppHandle, label: &str, visible: bool) {
    if !matches!(label, "pill" | "compact" | "hud") {
        tracing::warn!("save_widget_visibility: unknown label '{label}'");
        return;
    }
    STORE.update(app, |map| {
        map.insert(label.to_string(), StoredVisibility { visible });
    });
}
