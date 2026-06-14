use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// IP address or hostname to ping for latency measurement.
    #[serde(default = "AppSettings::default_ping_target")]
    pub ping_target: String,

    /// How often the network sampler fires, in milliseconds.
    /// Valid range: 500–5000 (enforced by both the command validator and clamp).
    #[serde(default = "AppSettings::default_refresh_interval_ms")]
    pub refresh_interval_ms: u32,

    /// Whether the first-launch onboarding wizard has been completed.
    #[serde(default)]
    pub onboarding_completed: bool,

    // When true, closing the main window hides it to the system tray instead of quitting.
    #[serde(default = "AppSettings::default_minimize_to_tray")]
    pub minimize_to_tray: bool,
}

impl AppSettings {
    pub fn default_ping_target() -> String {
        "1.1.1.1".to_string()
    }

    pub fn default_refresh_interval_ms() -> u32 {
        500
    }

    pub fn default_minimize_to_tray() -> bool {
        true
    }

    /// Clamp refresh_interval_ms to a safe range so rogue settings files cannot
    /// spin the CPU or make monitoring useless.
    ///
    /// command validator (which rejects < 500). The two were previously misaligned,
    /// allowing manually-edited JSON files to produce values the command would reject.
    pub fn clamped_refresh_interval_ms(&self) -> u32 {
        self.refresh_interval_ms.clamp(500, 5_000)
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            ping_target: Self::default_ping_target(),
            refresh_interval_ms: Self::default_refresh_interval_ms(),
            onboarding_completed: false,
            minimize_to_tray: Self::default_minimize_to_tray(),
        }
    }
}

pub type SettingsStore = PersistentStore<AppSettings>;
