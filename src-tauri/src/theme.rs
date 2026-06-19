use tauri::tray::TrayIconId;
use tauri::{AppHandle, image::Image};

pub fn tray_icon_for_theme(light_system: bool) -> tauri::Result<Image<'static>> {
    if light_system {
        Image::from_bytes(include_bytes!("../icons/tray-dark.png"))
    } else {
        Image::from_bytes(include_bytes!("../icons/tray-light.png"))
    }
}

#[cfg(target_os = "windows")]
pub fn is_system_light_theme() -> bool {
    use winreg::RegKey;
    use winreg::enums::*;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(key) = hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
    else {
        return false;
    };
    let val: u32 = key.get_value("SystemUsesLightTheme").unwrap_or(0);
    val == 1
}

#[cfg(not(target_os = "windows"))]
pub fn is_system_light_theme() -> bool {
    false
}

/// Watches for theme changes using registry change notifications (no polling).
/// Uses `RegNotifyChangeKeyValue` which blocks the thread until a change occurs.
pub fn spawn_theme_watcher(app: AppHandle, tray_id: TrayIconId) {
    std::thread::Builder::new()
        .name("theme-watcher".into())
        .spawn(move || {
            theme_watch_loop(&app, &tray_id);
        })
        .ok();
}

#[cfg(target_os = "windows")]
fn theme_watch_loop(app: &AppHandle, tray_id: &TrayIconId) {
    use windows::Win32::System::Registry::{
        HKEY, HKEY_CURRENT_USER, KEY_NOTIFY, REG_NOTIFY_CHANGE_LAST_SET, 
        RegNotifyChangeKeyValue, RegOpenKeyExW,
    };
    use windows::core::w;

    let mut hkey = HKEY::default();
    let status = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
            0,
            KEY_NOTIFY,
            &mut hkey,
        )
    };

    if status.is_err() {
        tracing::warn!(
            "Failed to open registry key for theme watching: {:?}",
            status
        );
        return;
    }

    let mut last_light = is_system_light_theme();

    loop {
        // This blocks until the registry key value changes — no polling, no CPU usage
        let result = unsafe {
            RegNotifyChangeKeyValue(
                hkey,
                false,                      // don't watch subtree
                REG_NOTIFY_CHANGE_LAST_SET, // notify on value changes
                None,                       // no event handle (synchronous wait)
                false,                      // synchronous (blocking)
            )
        };

        if result.is_err() {
            tracing::warn!("RegNotifyChangeKeyValue failed: {:?}", result);
            // Re-open the key and retry after a delay
            std::thread::sleep(std::time::Duration::from_secs(30));
            let reopen = unsafe {
                RegOpenKeyExW(
                    HKEY_CURRENT_USER,
                    w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
                    0,
                    KEY_NOTIFY,
                    &mut hkey,
                )
            };
            if reopen.is_err() {
                tracing::error!("Cannot reopen registry key for theme watching, giving up");
                return;
            }
            continue;
        }

        let current = is_system_light_theme();
        if current != last_light {
            last_light = current;
            tracing::info!(
                "System theme changed to {} — updating tray icon",
                if current { "light" } else { "dark" }
            );
            if let Ok(icon) = tray_icon_for_theme(current) {
                if let Some(tray) = app.tray_by_id(tray_id) {
                    let _ = tray.set_icon(Some(icon));
                }
            }
        }
    }
}
