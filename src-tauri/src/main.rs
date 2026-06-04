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
mod window_visibility;

use commands::network::{
    get_dashboard_snapshot, get_interfaces, get_network_stats, reset_peaks,
    set_compact_always_on_top, set_compact_opacity, set_hud_always_on_top, set_hud_opacity,
    set_interface, set_pill_always_on_top, set_pill_opacity,
};

use commands::ping::{get_ping_stats, SharedPingState};

use commands::storage::{
    get_daily_summary, get_history_range, get_hourly_summary, get_monthly_summary,
    get_usage_stats_cmd,
};

use commands::visibility::set_widget_visibility;

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};

use crate::window_positions::{enqueue_position, PositionSender};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(parking_lot::Mutex::new(
            commands::network::MonitorState::default(),
        ))
        .manage(parking_lot::Mutex::new(commands::ping::PingState::default()))
        .invoke_handler(tauri::generate_handler![
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
                // Retrieve the sender from Tauri state
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
