//! Windows look-and-feel the UI follows: the user's accent colour and whether
//! the dashboard can use the Mica backdrop (Windows 11+).
//!
//! The parsing helpers are pure so they can be tested on any platform; only
//! the registry reads are Windows-specific.

use serde::Serialize;
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, Runtime};

/// First Windows 11 build. Mica is unavailable before it.
#[cfg_attr(not(windows), allow(dead_code))]
const WINDOWS_11_FIRST_BUILD: u32 = 22_000;

/// The seven shades Windows derives from the accent colour, as `#rrggbb`.
/// WinUI uses `light2`/`light3` on dark backgrounds and `dark1`/`dark2` on
/// light ones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccentPalette {
    pub light3: String,
    pub light2: String,
    pub light1: String,
    pub base: String,
    pub dark1: String,
    pub dark2: String,
    pub dark3: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Appearance {
    /// `None` when the platform has no accent (non-Windows) or it can't be read.
    pub accent: Option<AccentPalette>,
    /// `"mica"` when the dashboard window was created with the Mica backdrop.
    pub material: &'static str,
}

/// Parses the `AccentPalette` registry value: eight RGBA quads, lightest to
/// darkest (Light3, Light2, Light1, Base, Dark1, Dark2, Dark3, unused).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn parse_accent_palette(bytes: &[u8]) -> Option<AccentPalette> {
    if bytes.len() < 28 {
        return None;
    }
    let hex = |i: usize| {
        let c = &bytes[i * 4..i * 4 + 3];
        format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
    };
    Some(AccentPalette {
        light3: hex(0),
        light2: hex(1),
        light1: hex(2),
        base: hex(3),
        dark1: hex(4),
        dark2: hex(5),
        dark3: hex(6),
    })
}

/// Parses `CurrentBuildNumber` (a decimal string such as `"22631"`).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn parse_build_number(value: &str) -> Option<u32> {
    value.trim().parse().ok()
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn build_supports_mica(build: u32) -> bool {
    build >= WINDOWS_11_FIRST_BUILD
}

#[cfg(windows)]
fn read_accent_palette() -> Option<AccentPalette> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Accent")
        .ok()?;
    let raw = key.get_raw_value("AccentPalette").ok()?;
    parse_accent_palette(&raw.bytes)
}

#[cfg(not(windows))]
fn read_accent_palette() -> Option<AccentPalette> {
    None
}

/// Whether this machine can show Mica (Windows 11 or later).
pub fn mica_supported() -> bool {
    #[cfg(windows)]
    {
        use winreg::RegKey;
        use winreg::enums::HKEY_LOCAL_MACHINE;

        RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
            .and_then(|k| k.get_value::<String, _>("CurrentBuildNumber"))
            .ok()
            .and_then(|s| parse_build_number(&s))
            .is_some_and(build_supports_mica)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Gives the dashboard window the Mica backdrop where supported. The window
/// must be transparent for the backdrop to show through the webview; the UI
/// paints an opaque background itself when Mica is unavailable.
pub fn with_backdrop<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    #[cfg(windows)]
    {
        use tauri::utils::{WindowEffect, config::WindowEffectsConfig};
        if mica_supported() {
            return builder.transparent(true).effects(WindowEffectsConfig {
                effects: vec![WindowEffect::Mica],
                ..Default::default()
            });
        }
    }
    builder
}

#[tauri::command]
pub fn get_appearance() -> Appearance {
    Appearance {
        accent: read_accent_palette(),
        material: if mica_supported() { "mica" } else { "solid" },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_default_windows_blue_palette() {
        // Bytes as stored by Windows for the default "Blue" accent.
        let bytes: [u8; 32] = [
            0x99, 0xeb, 0xff, 0x00, 0x4c, 0xc2, 0xff, 0x00, 0x00, 0x91, 0xf8, 0x00, 0x00, 0x78,
            0xd4, 0x00, 0x00, 0x67, 0xc0, 0x00, 0x00, 0x3e, 0x92, 0x00, 0x00, 0x1a, 0x68, 0x00,
            0xf7, 0x63, 0x0c, 0x00,
        ];
        let palette = parse_accent_palette(&bytes).unwrap();
        assert_eq!(palette.light3, "#99ebff");
        assert_eq!(palette.light2, "#4cc2ff");
        assert_eq!(palette.base, "#0078d4");
        assert_eq!(palette.dark1, "#0067c0");
        assert_eq!(palette.dark3, "#001a68");
    }

    #[test]
    fn rejects_truncated_palettes() {
        assert_eq!(parse_accent_palette(&[0u8; 27]), None);
        assert!(parse_accent_palette(&[0u8; 28]).is_some());
    }

    #[test]
    fn mica_needs_windows_11() {
        assert_eq!(parse_build_number(" 22631 "), Some(22_631));
        assert_eq!(parse_build_number("not a build"), None);
        assert!(build_supports_mica(22_000));
        assert!(build_supports_mica(26_100));
        assert!(!build_supports_mica(19_045)); // Windows 10 22H2
    }

    #[test]
    fn appearance_serialises_in_camel_case() {
        let json = serde_json::to_value(Appearance {
            accent: parse_accent_palette(&[0u8; 32]),
            material: "solid",
        })
        .unwrap();
        assert_eq!(json["material"], "solid");
        assert_eq!(json["accent"]["light2"], "#000000");
    }
}
