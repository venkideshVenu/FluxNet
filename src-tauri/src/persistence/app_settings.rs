use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// IP address or hostname to ping for latency measurement.
    #[serde(default = "AppSettings::default_ping_target")]
    pub ping_target: String,

    /// How often the network sampler fires, in milliseconds.
    /// Valid range: 100–5000.  Default: 500.
    #[serde(default = "AppSettings::default_refresh_interval_ms")]
    pub refresh_interval_ms: u32,

    /// Whether the first-launch onboarding wizard has been completed.
    #[serde(default)]
    pub onboarding_completed: bool,
}

impl AppSettings {
    pub fn default_ping_target() -> String {
        "1.1.1.1".to_string()
    }

    pub fn default_refresh_interval_ms() -> u32 {
        500
    }

    /// Clamp refresh_interval_ms to a safe range so rogue settings files cannot
    /// spin the CPU or make monitoring useless.
    pub fn clamped_refresh_interval_ms(&self) -> u32 {
        self.refresh_interval_ms.clamp(100, 5_000)
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            ping_target: Self::default_ping_target(),
            refresh_interval_ms: Self::default_refresh_interval_ms(),
            onboarding_completed: false
        }
    }
}

pub type SettingsStore = PersistentStore<AppSettings>;
