use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub ping_target: String,
}

impl AppSettings {
    pub fn default_ping_target() -> String {
        "1.1.1.1".to_string()
    }
}

pub type SettingsStore = PersistentStore<AppSettings>;
