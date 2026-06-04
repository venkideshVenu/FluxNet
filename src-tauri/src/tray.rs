use tauri::{App, AppHandle, Manager, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tokio_util::sync::CancellationToken;

use crate::commands::visibility::apply_widget_visibility;

pub fn build_tray(app: &App, cancel_token: CancellationToken) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Quit FluxNet", true, None::<&str>)?;
    let show_pill = MenuItem::with_id(app, "show_pill", "Show widget", true, None::<&str>)?;
    let hide_pill = MenuItem::with_id(app, "hide_pill", "Hide widget", true, None::<&str>)?;
    let show_compact = MenuItem::with_id(app, "show_compact", "Show compact widget", true, None::<&str>)?;
    let hide_compact = MenuItem::with_id(app, "hide_compact", "Hide compact widget", true, None::<&str>)?;
    let show_hud = MenuItem::with_id(app, "show_hud", "Show HUD", true, None::<&str>)?;
    let hide_hud = MenuItem::with_id(app, "hide_hud", "Hide HUD", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, "dashboard", "Open dashboard", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &dashboard,
            &show_pill,
            &hide_pill,
            &show_compact,
            &hide_compact,
            &show_hud,
            &hide_hud,
            &quit,
        ],
    )?;

    let token = cancel_token.clone();
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app_handle, event| {
            match event.id.as_ref() {
                "quit" => {
                    // Signal background task to stop gracefully
                    token.cancel();
                    // Give a tiny moment for the task to checkpoint
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    app_handle.exit(0);
                }
                "show_pill" => {
                    let _ = apply_widget_visibility(app_handle, "pill", true);
                }
                "hide_pill" => {
                    let _ = apply_widget_visibility(app_handle, "pill", false);
                }
                "show_compact" => {
                    let _ = apply_widget_visibility(app_handle, "compact", true);
                }
                "hide_compact" => {
                    let _ = apply_widget_visibility(app_handle, "compact", false);
                }
                "show_hud" => {
                    let _ = apply_widget_visibility(app_handle, "hud", true);
                }
                "hide_hud" => {
                    let _ = apply_widget_visibility(app_handle, "hud", false);
                }
                "dashboard" => {
                    open_dashboard(app_handle);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("pill") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = apply_widget_visibility(app, "pill", false);
                    } else {
                        let _ = apply_widget_visibility(app, "pill", true);
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

pub fn open_dashboard(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
        .title("FluxNet")
        .inner_size(900.0, 600.0)
        .min_inner_size(720.0, 500.0)
        .decorations(true)
        .resizable(true)
        .center()
        .build();
}