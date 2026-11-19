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

    /// The adapter the user chose in Network adapters. `None` (the default)
    /// means automatic: follow the adapter Windows uses for the internet.
    #[serde(default)]
    pub manual_interface: Option<String>,
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
            manual_interface: None,
        }
    }
}

pub type SettingsStore = PersistentStore<AppSettings>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_saved_before_manual_adapters_mean_automatic() {
        let old = r#"{"ping_target":"1.1.1.1","refresh_interval_ms":500,"onboarding_completed":true,"minimize_to_tray":true}"#;
        let settings: AppSettings = serde_json::from_str(old).unwrap();
        assert_eq!(settings.manual_interface, None);
    }

    #[test]
    fn a_manual_adapter_round_trips() {
        let settings = AppSettings {
            manual_interface: Some("Ethernet".into()),
            ..AppSettings::default()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.manual_interface.as_deref(), Some("Ethernet"));
    }
}
