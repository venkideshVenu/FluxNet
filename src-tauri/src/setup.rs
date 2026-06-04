use std::error::Error;
use tauri::{App, Manager};

use crate::{
    background::sampler::start_sampler, commands::network::SharedMonitorState, storage::DbState,
    tray::build_tray, window_positions::{restore_widget_positions, spawn_position_writer},
    window_visibility::load_widget_visibility,
};

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let monitor_state = app.state::<SharedMonitorState>().inner().clone();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    let db_state = DbState::open(&app_data_dir).expect("failed to open FluxNet database");

    app.manage(db_state);

    let state_for_task = monitor_state.clone();

    let bg_db = DbState::open(&app_data_dir).expect("background DB open failed");

    start_sampler(state_for_task, bg_db);

    let app_handle = app.handle();

    let pos_sender = spawn_position_writer(app_handle.clone());
    app.manage(pos_sender); // store the sender in Tauri state

    // Restore positions after the webviews are ready (uses on_webview_event)
    restore_widget_positions(&app_handle);

    // Build tray, etc.
    crate::tray::build_tray(app)?;

    Ok(())
}
