// Prevents a console window from appearing on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod monitor;

use commands::network::{get_interfaces, get_network_stats, set_interface, SharedMonitorState};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(commands::network::MonitorState::default()) as SharedMonitorState)
        .invoke_handler(tauri::generate_handler![
            get_network_stats,
            get_interfaces,
            set_interface,
        ])
        .setup(|app| {
            // Build system tray
            let quit = MenuItem::with_id(app, "quit", "Quit FluxNet", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show widget", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide widget", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("pill") {
                            let _ = w.show();
                        }
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("pill") {
                            let _ = w.hide();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("pill") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FluxNet");
}
