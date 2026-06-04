use std::error::Error;
use tauri::{App, Manager};
use tokio_util::sync::CancellationToken;

use crate::{
    background::sampler::start_sampler,
    commands::network::SharedMonitorState,
    storage::DbState,
    tray::build_tray,
    window_positions::{restore_widget_positions, spawn_position_writer},
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

    // ── Create cancellation token for background sampler ──
    let cancel_token = CancellationToken::new();
    let task_token = cancel_token.clone();
    app.manage(cancel_token.clone());

    start_sampler(state_for_task, bg_db, task_token);
    let app_handle = app.handle();

    let pos_sender = spawn_position_writer(app_handle.clone());
    app.manage(pos_sender);

    load_widget_visibility(&app_handle);
    restore_widget_positions(&app_handle);

    build_tray(app, cancel_token)?;

    Ok(())
}
