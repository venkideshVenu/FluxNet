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
    get_ping_target, get_refresh_interval, set_ping_target, set_refresh_interval,
};
use commands::storage::{
    get_daily_summary, get_history_range, get_hourly_summary, get_monthly_summary,
    get_usage_stats_cmd,
};
use commands::visibility::{set_widget_always_on_top, set_widget_opacity, set_widget_visibility};
use std::sync::Arc;
use tauri::{Manager, WindowEvent};

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

        // Derive the log directory without pulling in the `dirs` crate:
        // %APPDATA%\fluxnet\logs  (Windows) or  ~/.local/share/fluxnet/logs  (future macOS)
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
        // Leak the guard so it lives until process exit and the final log flush completes.
        Box::leak(Box::new(guard));

        tracing_subscriber::registry()
            .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
            .with(EnvFilter::new("fluxnet=info,warn"))
            .init();
    }
}

fn main() {
    init_logging();
    // ─────────────────────────────────────────────────────────────────────────

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Core shared state
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::network::MonitorState::default(),
        )))
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::ping::PingState::default(),
        )))
        // NOTE: SharedInterfacesCache and SamplerHandle are managed inside setup()
        // after construction so they have access to the AppHandle.
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
            get_ping_target,
            set_ping_target,
            get_refresh_interval,
            set_refresh_interval,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Moved(position) = event {
                let app_handle = window.app_handle();
                if let Some(sender) = app_handle.try_state::<PositionSender>() {
                    enqueue_position(&sender, window.label(), *position);
                }
            }
        })
        .setup(setup::setup)
        .run(tauri::generate_context!())
        .expect("error while running FluxNet");
}
