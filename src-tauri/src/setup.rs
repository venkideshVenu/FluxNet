use crate::commands::ping::SharedPingState;
use std::error::Error;
use tauri::{App, Manager, WebviewEvent, WindowEvent};
use tokio_util::sync::CancellationToken;

use crate::{
    background::sampler::start_sampler,
    commands::network::SharedMonitorState,
    storage::DbState,
    tray::build_tray,
    window_positions::{spawn_position_writer, PositionMap, STORE as POSITION_STORE},
    window_visibility::{VisibilityMap, STORE as VISIBILITY_STORE},
};

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let monitor_state = app.state::<SharedMonitorState>().inner().clone();
    let ping_state = app.state::<SharedPingState>().inner().clone();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    let db_state = DbState::open(&app_data_dir).expect("failed to open FluxNet database");
    app.manage(db_state);

    let bg_db = DbState::open(&app_data_dir).expect("background DB open failed");

    let cancel_token = CancellationToken::new();
    let task_token = cancel_token.clone();
    app.manage(cancel_token.clone());

    start_sampler(monitor_state, bg_db, ping_state, task_token);
    let app_handle = app.handle();

    let pos_sender = spawn_position_writer(app_handle.clone());
    app.manage(pos_sender);

    // Load saved positions and visibility into the persistent stores
    POSITION_STORE.load(&app_handle);
    VISIBILITY_STORE.load(&app_handle);

    for label in ["pill", "compact", "hud"] {
        if let Some(window) = app.get_webview_window(label) {
            let label_str = label.to_string();

            // Restore position
            let positions = POSITION_STORE.read(|m| m.clone());
            if let Some(pos) = positions.get(&label_str) {
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: pos.x,
                    y: pos.y,
                }));
            }

            // Restore visibility
            let visibility_map = VISIBILITY_STORE.read(|m| m.clone());
            let visible = visibility_map
                .get(&label_str)
                .map(|v| v.visible)
                .unwrap_or(true);

            if visible {
                let _ = window.show();
            } else {
                let _ = window.hide();
            }
        }
    }

    if let Some(main_window) = app.get_webview_window("main") {
        let main_window_clone = main_window.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = main_window_clone.hide();
            }
        });
    }

    build_tray(app, cancel_token)?;

    Ok(())
}
