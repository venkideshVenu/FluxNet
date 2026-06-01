#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod monitor;
mod storage;
mod window_positions;
mod window_visibility;

use commands::network::{
    get_dashboard_snapshot, get_interfaces, get_network_stats, reset_peaks,
    set_compact_always_on_top, set_compact_opacity, set_hud_always_on_top, set_hud_opacity,
    set_interface, set_pill_always_on_top, set_pill_opacity, set_widget_visibility, tick_sample,
    SharedMonitorState,
};
use commands::ping::{get_ping_stats, SharedPingState};
use commands::storage::{
    get_daily_summary, get_history_range, get_hourly_summary, get_monthly_summary,
    get_usage_stats_cmd,
};
use storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use storage::repository::{cleanup_old_samples, insert_sample};
use storage::DbState;
use window_positions::{restore_widget_positions, save_widget_position};
use window_visibility::{restore_widget_visibility, save_widget_visibility};

use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindowBuilder,
};

fn main() {
    // Use Arc<Mutex<_>> so we can clone it into the background task.
    let monitor_state: SharedMonitorState =
        Arc::new(Mutex::new(commands::network::MonitorState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(monitor_state.clone())
        .manage(Mutex::new(commands::ping::PingState::default()) as SharedPingState)
        .invoke_handler(tauri::generate_handler![
            // ── existing network commands ─────────────────────────────────
            get_network_stats,
            get_dashboard_snapshot,
            get_interfaces,
            set_interface,
            reset_peaks,
            set_compact_always_on_top,
            set_compact_opacity,
            set_hud_always_on_top,
            set_hud_opacity,
            set_pill_always_on_top,
            set_pill_opacity,
            set_widget_visibility,
            get_ping_stats,
            // ── new persistence commands ──────────────────────────────────
            get_usage_stats_cmd,
            get_history_range,
            get_hourly_summary,
            get_daily_summary,
            get_monthly_summary,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Moved(position) = event {
                save_widget_position(&window.app_handle(), window.label(), *position);
            }
        })
        .setup(move |app| {
            // ── Open SQLite database ──────────────────────────────────────
            // Resolves to %APPDATA%\FluxNet\fluxnet.db on Windows.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let db_state = DbState::open(&app_data_dir).expect("failed to open FluxNet database");
            app.manage(db_state);
            let app_handle = app.handle().clone();
            restore_widget_positions(&app_handle);
            restore_widget_visibility(&app_handle);

            // ── Single background sampler ─────────────────────────────────
            // Ticks every 500 ms — the only place that ever calls
            // tick_sample(). All Tauri commands just read the cached result.
            // This guarantees every window sees identical numbers.
            //
            // We open a second DB connection on this thread so writes never
            // block command handlers. Both connections use WAL mode and can
            // run concurrently without contention.
            let state_for_task = monitor_state.clone();
            let db_path_for_task = app_data_dir.clone();

            tauri::async_runtime::spawn(async move {
                // Dedicated DB connection for the background writer.
                let bg_db = DbState::open(&db_path_for_task).expect("background DB open failed");

                let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));

                // Housekeeping timers
                let mut last_cleanup = tokio::time::Instant::now();
                let cleanup_interval = std::time::Duration::from_secs(60);

                // Track hour/day changes to trigger rollups exactly once.
                let mut last_hour: Option<u32> = None;
                let mut last_day: Option<u32> = None;

                loop {
                    interval.tick().await;

                    // ── 1. Tick the network sampler ───────────────────────
                    let (dl_bps, ul_bps, iface) = {
                        let mut s = state_for_task.lock().unwrap();
                        tick_sample(&mut s);
                        (s.last_download, s.last_upload, s.interface.clone())
                    };

                    // ── 2. Write raw sample to SQLite ─────────────────────
                    // Skip the initial priming tick where both values are 0.0
                    // and the interface may not be selected yet.
                    if !iface.is_empty() && (dl_bps > 0.0 || ul_bps > 0.0) {
                        let now_ts = chrono::Local::now().timestamp();
                        if let Ok(conn) = bg_db.0.lock() {
                            let _ = insert_sample(&conn, now_ts, &iface, dl_bps, ul_bps);
                        }
                    }

                    // ── 3. Cleanup old raw samples (every 60 s) ───────────
                    if last_cleanup.elapsed() >= cleanup_interval {
                        let cutoff = chrono::Local::now().timestamp() - 7 * 86_400;
                        if let Ok(conn) = bg_db.0.lock() {
                            let _ = cleanup_old_samples(&conn, cutoff);
                        }
                        last_cleanup = tokio::time::Instant::now();
                    }

                    // ── 4. Hourly rollup — fires once when the hour turns ─
                    let now_local = chrono::Local::now();
                    let current_hour = chrono::Timelike::hour(&now_local);
                    let current_day = chrono::Datelike::day(&now_local);

                    if let Some(prev_hour) = last_hour {
                        if prev_hour != current_hour {
                            // The hour just changed — roll up the completed hour.
                            if let Ok(conn) = bg_db.0.lock() {
                                let _ = rollup_hourly(&conn);
                            }
                        }
                    }
                    last_hour = Some(current_hour);

                    // ── 5. Daily rollup — fires once when the day turns ───
                    if let Some(prev_day) = last_day {
                        if prev_day != current_day {
                            // The day just changed — roll up yesterday.
                            if let Ok(conn) = bg_db.0.lock() {
                                let _ = rollup_daily(&conn);

                                // On the 1st of a new month, also roll up last month.
                                if current_day == 1 {
                                    let _ = rollup_monthly(&conn);
                                }
                            }
                        }
                    }
                    last_day = Some(current_day);
                }
            });

            // ── Tray menu ─────────────────────────────────────────────────
            let quit = MenuItem::with_id(app, "quit", "Quit FluxNet", true, None::<&str>)?;
            let show_pill = MenuItem::with_id(app, "show_pill", "Show widget", true, None::<&str>)?;
            let hide_pill = MenuItem::with_id(app, "hide_pill", "Hide widget", true, None::<&str>)?;
            let show_compact = MenuItem::with_id(
                app,
                "show_compact",
                "Show compact widget",
                true,
                None::<&str>,
            )?;
            let hide_compact = MenuItem::with_id(
                app,
                "hide_compact",
                "Hide compact widget",
                true,
                None::<&str>,
            )?;
            let dashboard =
                MenuItem::with_id(app, "dashboard", "Open dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &dashboard,
                    &show_pill,
                    &hide_pill,
                    &show_compact,
                    &hide_compact,
                    &quit,
                ],
            )?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show_pill" => {
                        if let Some(w) = app.get_webview_window("pill") {
                            let _ = w.show();
                            save_widget_visibility(app, "pill", true);
                        }
                    }
                    "hide_pill" => {
                        if let Some(w) = app.get_webview_window("pill") {
                            let _ = w.hide();
                            save_widget_visibility(app, "pill", false);
                        }
                    }
                    "show_compact" => {
                        if let Some(w) = app.get_webview_window("compact") {
                            let _ = w.show();
                            let _ = w.set_focus();
                            save_widget_visibility(app, "compact", true);
                        }
                    }
                    "hide_compact" => {
                        if let Some(w) = app.get_webview_window("compact") {
                            let _ = w.hide();
                            save_widget_visibility(app, "compact", false);
                        }
                    }
                    "dashboard" => open_dashboard(app),
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
                                save_widget_visibility(&app, "pill", false);
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                                save_widget_visibility(&app, "pill", true);
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FluxNet")
}

fn open_dashboard(app: &tauri::AppHandle) {
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
