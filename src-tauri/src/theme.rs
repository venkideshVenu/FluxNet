use std::time::Duration;
use tauri::tray::TrayIconId;
use tauri::{image::Image, AppHandle};
use tokio::time;

pub fn tray_icon_for_theme(light_system: bool) -> tauri::Result<Image<'static>> {
    if light_system {
        Image::from_bytes(include_bytes!("../icons/tray-dark.png"))
    } else {
        Image::from_bytes(include_bytes!("../icons/tray-light.png"))
    }
}

#[cfg(target_os = "windows")]
pub fn is_system_light_theme() -> bool {
    // <-- added pub
    use std::process::Command;
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            "/v",
            "SystemUsesLightTheme",
        ])
        .output();
    match output {
        Ok(out) => String::from_utf8_lossy(&out.stdout).contains("0x1"),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_system_light_theme() -> bool {
    // <-- added pub
    false // extend for macOS/Linux if needed
}

pub fn spawn_theme_watcher(app: AppHandle, tray_id: TrayIconId) {
    // Id is now in scope
    tauri::async_runtime::spawn(async move {
        let mut last_light = is_system_light_theme();
        let mut interval = time::interval(Duration::from_secs(5));
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            let current = is_system_light_theme();
            if current != last_light {
                last_light = current;
                tracing::info!(
                    "System theme changed to {} — updating tray icon",
                    if current { "light" } else { "dark" }
                );
                if let Ok(icon) = tray_icon_for_theme(current) {
                    if let Some(tray) = app.tray_by_id(&tray_id) {
                        let _ = tray.set_icon(Some(icon));
                    }
                }
            }
        }
    });
}
