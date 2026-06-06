use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Full persisted state for all widget windows.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WidgetState {
    pub positions: HashMap<String, StoredPosition>,
    /// Per-widget configuration (visibility + always_on_top).
    pub configs: HashMap<String, StoredConfig>,

    // Legacy field kept for migration compatibility — new code writes `configs`.
    #[serde(default, skip_serializing)]
    pub visibility: HashMap<String, StoredVisibility>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct StoredPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct StoredConfig {
    #[serde(default = "default_true")]
    pub visible: bool,

    #[serde(default)]
    pub always_on_top: bool,
}

impl Default for StoredConfig {
    fn default() -> Self {
        Self {
            visible: true,
            always_on_top: false,
        }
    }
}

/// Legacy type — retained so old JSON can still be deserialised during migration.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct StoredVisibility {
    #[serde(default = "default_true")]
    pub visible: bool,
}

impl Default for StoredVisibility {
    fn default() -> Self {
        Self { visible: true }
    }
}

fn default_true() -> bool {
    true
}

impl WidgetState {
    /// Migrate any legacy `visibility` entries into `configs` so they are not lost.
    pub fn migrate_legacy(&mut self) {
        for (label, sv) in self.visibility.drain() {
            self.configs.entry(label).or_default().visible = sv.visible;
        }
    }

    fn is_valid_label(label: &str) -> bool {
        matches!(label, "pill" | "compact" | "hud")
    }

    pub fn set_visibility(&mut self, label: &str, visible: bool) {
        if Self::is_valid_label(label) {
            self.configs.entry(label.to_string()).or_default().visible = visible;
        }
    }

    pub fn set_always_on_top(&mut self, label: &str, value: bool) {
        if Self::is_valid_label(label) {
            self.configs
                .entry(label.to_string())
                .or_default()
                .always_on_top = value;
        }
    }

    pub fn get_config(&self, label: &str) -> StoredConfig {
        self.configs.get(label).copied().unwrap_or_default()
    }
}
