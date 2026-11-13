#![windows_subsystem = "windows"]

mod app_windows;
mod background;
mod commands;
mod dto;
mod monitor;
mod persistence;
mod placement;
mod setup;
mod storage;
mod theme;
mod tray;
mod window_positions;

use crate::window_positions::{PositionSender, enqueue_position};
use commands::network::{
    get_dashboard_snapshot, get_interfaces, get_network_stats, reset_peaks, set_interface,
};
use commands::ping::get_ping_stats;
use commands::settings::{
    get_minimize_to_tray, get_onboarding_completed, get_ping_target, get_refresh_interval,
    set_minimize_to_tray, set_onboarding_completed, set_ping_target, set_refresh_interval,
};
use commands::storage::{
    get_daily_summary, get_history_range, get_hourly_summary, get_monthly_summary,
    get_usage_stats_cmd,
};
use commands::visibility::{
    get_hud_design, get_widget_visibility, set_hud_design, set_widget_always_on_top,
    set_widget_opacity, set_widget_visibility,
};
use persistence::app_settings::SettingsStore;
use std::sync::Arc;
use tauri::{Manager, RunEvent, WindowEvent};
use tokio_util::sync::CancellationToken;

fn init_logging() {
    use tracing_subscriber::{EnvFilter, fmt};

    #[cfg(debug_assertions)]
    {
        fmt()
            .with_env_filter(
                EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| EnvFilter::new("fluxnet=debug,warn")),
            )
            .with_target(false)
            .init();
    }

    #[cfg(not(debug_assertions))]
    {
        use tracing_subscriber::prelude::*;

        let log_dir = {
            let base = std::env::var("APPDATA")
                .map(std::path::PathBuf::from)
                .or_else(|_| {
                    std::env::var("HOME")
                        .map(|h| std::path::PathBuf::from(h).join(".local").join("share"))
                })
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            base.join("fluxnet").join("logs")
        };
        std::fs::create_dir_all(&log_dir).ok();

        let file_appender = tracing_appender::rolling::daily(&log_dir, "fluxnet.log");
        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
        Box::leak(Box::new(guard));

        tracing_subscriber::registry()
            .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
            .with(EnvFilter::new("fluxnet=info,warn"))
            .init();
    }
}

fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Box<dyn Any>".to_string()
        };

        tracing::error!("PANIC at {}: {}", location, payload);

        let crash_path = std::env::var("APPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join("fluxnet")
            .join("logs")
            .join("last_crash.log");

        let crash_msg = format!(
            "[{}] PANIC at {}: {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            location,
            payload
        );
        let _ = std::fs::write(&crash_path, &crash_msg);

        default_hook(info);
    }));
}

fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == "--autostart" || arg == "--minimized")
}

fn main() {
    init_logging();
    install_panic_hook();

    tracing::info!(
        "FluxNet {} starting (autostart={})",
        env!("CARGO_PKG_VERSION"),
        is_autostart_launch()
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            app_windows::spawn_on_app(app, app_windows::open_dashboard);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::network::MonitorState::default(),
        )))
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::ping::PingState::default(),
        )))
        .invoke_handler(tauri::generate_handler![
            // Network monitoring
            get_network_stats,
            get_dashboard_snapshot,
            get_interfaces,
            set_interface,
            reset_peaks,
            set_widget_opacity,
            set_widget_always_on_top,
            set_widget_visibility,
            get_widget_visibility,
            // HUD design
            set_hud_design,
            get_hud_design,
            // Ping
            get_ping_stats,
            // Storage / history
            get_usage_stats_cmd,
            get_history_range,
            get_hourly_summary,
            get_daily_summary,
            get_monthly_summary,
            // Settings
            get_ping_target,
            set_ping_target,
            get_refresh_interval,
            set_refresh_interval,
            get_onboarding_completed,
            set_onboarding_completed,
            get_minimize_to_tray,
            set_minimize_to_tray,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(position) => {
                let app_handle = window.app_handle();
                if let Some(sender) = app_handle.try_state::<PositionSender>() {
                    enqueue_position(&sender, window.label(), *position);
                }
            }
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                let app_handle = window.app_handle();
                if let Some(store) = app_handle.try_state::<Arc<SettingsStore>>() {
                    let minimize = store.read(|s| s.minimize_to_tray);
                    if minimize {
                        // Let the window close: destroying the webview frees its
                        // renderer memory. The tray recreates it on demand.
                        tracing::debug!("Main window closed to tray (minimize_to_tray=true)");
                    } else {
                        api.prevent_close();
                        tracing::debug!("minimize_to_tray=false, shutting down app");

                        let cancel_token = match app_handle.try_state::<CancellationToken>() {
                            Some(t) => t.clone(),
                            None => {
                                tracing::error!("CancellationToken missing, exiting immediately");
                                app_handle.exit(0);
                                return;
                            }
                        };

                        let widget_store = match app_handle.try_state::<Arc<
                            crate::persistence::persistent_store::PersistentStore<
                                crate::persistence::widget_state::WidgetState,
                            >,
                        >>() {
                            Some(s) => s.clone(),
                            None => {
                                tracing::error!("WidgetStore missing, exiting immediately");
                                app_handle.exit(0);
                                return;
                            }
                        };

                        crate::tray::perform_shutdown(app_handle, &cancel_token, &widget_store);
                    }
                } else {
                    app_handle.exit(0);
                }
            }
            _ => {}
        })
        .setup(setup::setup)
        .build(tauri::generate_context!())
        .expect("error while building FluxNet")
        .run(|_app, event| {
            // With no windows open (dashboard closed to tray, widgets off) Tauri
            // asks to exit with no code. Keep running in the tray; explicit
            // `app.exit(code)` calls carry a code and still exit.
            if let RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
}
