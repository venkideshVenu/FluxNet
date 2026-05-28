#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod monitor;

use commands::network::{
    get_dashboard_snapshot, get_interfaces, get_network_stats,
    reset_peaks, set_interface, SharedMonitorState,
};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindowBuilder,
};

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(commands::network::MonitorState::default()) as SharedMonitorState)
        .invoke_handler(tauri::generate_handler![
            get_network_stats,
            get_dashboard_snapshot,
            get_interfaces,
            set_interface,
            reset_peaks,
        ])
        .setup(|app| {
            let quit     = MenuItem::with_id(app, "quit",      "Quit FluxNet",     true, None::<&str>)?;
            let show_pill= MenuItem::with_id(app, "show_pill", "Show widget",      true, None::<&str>)?;
            let hide_pill= MenuItem::with_id(app, "hide_pill", "Hide widget",      true, None::<&str>)?;
            let dashboard= MenuItem::with_id(app, "dashboard", "Open dashboard",   true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&dashboard, &show_pill, &hide_pill, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit"       => app.exit(0),
                    "show_pill"  => {
                        if let Some(w) = app.get_webview_window("pill") { let _ = w.show(); }
                    }
                    "hide_pill"  => {
                        if let Some(w) = app.get_webview_window("pill") { let _ = w.hide(); }
                    }
                    "dashboard"  => open_dashboard(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("pill") {
                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
                            else { let _ = w.show(); let _ = w.set_focus(); }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FluxNet");
}

fn open_dashboard(app: &tauri::AppHandle) {
    // If already open, just focus it
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    // Otherwise create it
    let _ = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
        .title("FluxNet")
        .inner_size(900.0, 600.0)
        .min_inner_size(720.0, 500.0)
        .decorations(true)
        .resizable(true)
        .center()
        .build();
}