#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod background;
mod commands;
mod dto;
mod monitor;
mod persistence;
mod setup;
mod storage;
mod tray;
mod window_positions;

use crate::window_positions::{enqueue_position, PositionSender};
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
use commands::visibility::{set_widget_always_on_top, set_widget_opacity, set_widget_visibility};
use persistence::app_settings::SettingsStore;
use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use tokio_util::sync::CancellationToken;

fn init_logging() {
    use tracing_subscriber::{fmt, EnvFilter};

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

        // Also write to a crash file as a last resort
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

/// Detect if app was launched via autostart (command-line flag or registry).
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
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Moved(position) => {
                    let app_handle = window.app_handle();
                    if let Some(sender) = app_handle.try_state::<PositionSender>() {
                        enqueue_position(&sender, window.label(), *position);
                    }
                }
                // If minimize_to_tray is enabled, hide instead of closing so
                // background monitoring and the tray icon remain active.
                // In main.rs, inside on_window_event for "main"
                WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        let app_handle = window.app_handle();
                        if let Some(store) = app_handle.try_state::<Arc<SettingsStore>>() {
                            let minimize = store.read(|s| s.minimize_to_tray);
                            if minimize {
                                api.prevent_close();
                                window.hide().ok();
                                tracing::debug!(
                                    "Main window hidden to tray (minimize_to_tray=true)"
                                );
                            } else {
                                // Run in background disabled → quit the whole app
                                api.prevent_close(); // prevent default close, we handle it
                                tracing::debug!("minimize_to_tray=false, shutting down app");

                                // Retrieve necessary state
                                let cancel_token = match app_handle.try_state::<CancellationToken>()
                                {
                                    Some(t) => t.clone(),
                                    None => {
                                        tracing::error!(
                                            "CancellationToken missing, exiting immediately"
                                        );
                                        app_handle.exit(0);
                                        return;
                                    }
                                };
                                let widget_store = app_handle
                                    .state::<Arc<
                                        crate::persistence::persistent_store::PersistentStore<
                                            crate::persistence::widget_state::WidgetState,
                                        >,
                                    >>()
                                    .clone();

                                crate::tray::perform_shutdown(
                                    &app_handle,
                                    &cancel_token,
                                    &widget_store,
                                );
                            }
                        } else {
                            // Fallback – no store, just exit
                            app_handle.exit(0);
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(setup::setup)
        .run(tauri::generate_context!())
        .expect("error while running FluxNet");
}
