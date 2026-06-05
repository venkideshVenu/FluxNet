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
    set_widget_always_on_top, set_widget_opacity,
};
use commands::ping::get_ping_stats;
use commands::storage::{
    get_daily_summary, get_history_range, get_hourly_summary, get_monthly_summary,
    get_usage_stats_cmd,
};
use commands::visibility::set_widget_visibility;
use std::sync::Arc;
use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Store Arc<Mutex<MonitorState>> so that background task can clone the Arc
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::network::MonitorState::default(),
        )))
        .manage(Arc::new(parking_lot::Mutex::new(
            commands::ping::PingState::default(),
        )))
        .invoke_handler(tauri::generate_handler![
            get_network_stats,
            get_dashboard_snapshot,
            get_interfaces,
            set_interface,
            reset_peaks,
            set_widget_opacity,
            set_widget_always_on_top,
            get_ping_stats,
            get_usage_stats_cmd,
            get_history_range,
            get_hourly_summary,
            get_daily_summary,
            get_monthly_summary,
            set_widget_visibility,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Moved(position) = event {
                let app_handle = window.app_handle();
                if let Some(sender) = app_handle.try_state::<PositionSender>() {
                    enqueue_position(&sender.0, window.label(), *position);
                }
            }
        })
        .setup(setup::setup)
        .run(tauri::generate_context!())
        .expect("error while running FluxNet");
}