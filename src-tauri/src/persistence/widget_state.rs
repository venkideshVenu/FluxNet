use serde::{Deserialize, Serialize};
use std::collections::{ HashMap};

/// Merged state for all widget-related persistence.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WidgetState {
    pub positions: HashMap<String, StoredPosition>,
    pub visibility: HashMap<String, StoredVisibility>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct StoredPosition {
    pub x: i32,
    pub y: i32,
}

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

impl WidgetState {
    pub fn set_visibility(&mut self, label: &str, visible: bool) {
        if matches!(label, "pill" | "compact" | "hud") {
            self.visibility
                .insert(label.to_string(), StoredVisibility { visible });
        }
    }
}
