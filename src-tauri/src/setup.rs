use crate::background::sampler::start_sampler;
use crate::commands::network::SharedMonitorState;
use crate::commands::ping::SharedPingState;
use crate::storage::db::{DbState, ReadOnlyDb};
use crate::tray::build_tray;
use crate::window_positions::{spawn_position_writer, PositionStore};
use crate::window_visibility::VisibilityStore;
use std::error::Error;
use std::sync::Arc;
use tauri::{App, Listener, Manager, PhysicalPosition, Position, WindowEvent};
use tokio_util::sync::CancellationToken;

/// Clamp a position so the widget stays within the monitor's work area.
/// If no monitor or size can be determined, returns original coordinates.
fn clamp_position(
    window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
) -> (i32, i32) {
    let monitor = match window.current_monitor() {
        Ok(Some(m)) => Some(m),
        _ => window.primary_monitor().ok().flatten(),
    };
    let Some(monitor) = monitor else {
        return (x, y);
    };
    let Ok(window_size) = window.outer_size() else {
        return (x, y);
    };
    let work_area = monitor.work_area();
    let left = work_area.position.x;
    let right = work_area.position.x + work_area.size.width as i32;
    let top = work_area.position.y;
    let bottom = work_area.position.y + work_area.size.height as i32;
    let clamped_x = x.clamp(left, right - window_size.width as i32);
    let clamped_y = y.clamp(top, bottom - window_size.height as i32);
    (clamped_x, clamped_y)
}

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let monitor_state = app.state::<SharedMonitorState>().inner().clone();
    let ping_state = app.state::<SharedPingState>().inner().clone();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    // Single read‑write connection for background sampler
    let rw_db = DbState::open(&app_data_dir).expect("failed to open read‑write DB");
    // Read‑only connection for command handlers
    let ro_db = ReadOnlyDb::open(&app_data_dir).expect("failed to open read‑only DB");
    app.manage(rw_db.clone());
    app.manage(ro_db);

    let cancel_token = CancellationToken::new();
    let task_token = cancel_token.clone();
    app.manage(cancel_token.clone());

    // Start background sampler with read‑write connection
    start_sampler(monitor_state, rw_db, ping_state, task_token);

    let app_handle = app.handle();

    // --- Position and visibility stores (managed by Tauri) ---
    let pos_store = Arc::new(PositionStore::new("widget-positions.json"));
    let vis_store = Arc::new(VisibilityStore::new("widget-visibility.json"));
    app.manage(pos_store.clone());
    app.manage(vis_store.clone());

    // Load existing visibility data from disk
    vis_store.load(&app_handle);

    // Spawn debounced position writer (it also loads existing positions)
    // Clone the Arc so we keep the original for later use
    let pos_sender = spawn_position_writer(app_handle.clone(), pos_store.clone());
    app.manage(pos_sender);

    // --- Widget windows: position & visibility after page load ---
    for label in ["pill", "compact", "hud"] {
        if let Some(window) = app.get_webview_window(label) {
            let window_clone = window.clone();
            let label_str = label.to_string();
            let app_handle = app_handle.clone();
            let pos_store = pos_store.clone(); // clone the Arc for this iteration
            let vis_store_for_position = vis_store.clone(); // for the page-load closure
            let vis_store_for_close = vis_store.clone(); // for the close/destroy closure

            window.listen("tauri://page-load", move |_| {
                // Restore position (clamped to screen)
                let positions = pos_store.read(|m| m.clone());
                if let Some(pos) = positions.get(&label_str) {
                    let (clamped_x, clamped_y) = clamp_position(&window_clone, pos.x, pos.y);
                    let _ = window_clone.set_position(Position::Physical(PhysicalPosition {
                        x: clamped_x,
                        y: clamped_y,
                    }));
                }
                // Restore visibility
                let visible = vis_store_for_position
                    .read(|m| m.clone())
                    .get(&label_str)
                    .map(|v| v.visible)
                    .unwrap_or(true);
                if visible {
                    let _ = window_clone.show(); // no focus steal
                } else {
                    let _ = window_clone.hide();
                }
            });

            // Handle close/destroy -> hide and save visibility state
            let window_clone2 = window.clone();
            let app_handle_clone2 = app_handle.clone();
            let label_str2 = label.to_string();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone2.hide();
                    crate::window_visibility::save_widget_visibility(
                        &vis_store_for_close,
                        &app_handle_clone2,
                        &label_str2,
                        false,
                    );
                } else if let WindowEvent::Destroyed = event {
                    crate::window_visibility::save_widget_visibility(
                        &vis_store_for_close,
                        &app_handle_clone2,
                        &label_str2,
                        false,
                    );
                }
            });
        }
    }

    // --- Main window: hide instead of destroy on close ---
    if let Some(main_window) = app.get_webview_window("main") {
        let main_window_clone = main_window.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = main_window_clone.hide();
            }
        });
    }

    // Pass an owned AppHandle to build_tray
    build_tray(app.handle().clone(), cancel_token)?;
    Ok(())
}