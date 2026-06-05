use crate::background::sampler::start_sampler;
use crate::commands::network::SharedMonitorState;
use crate::commands::ping::SharedPingState;
use crate::storage::db::{DbState, ReadOnlyDb};
use crate::tray::build_tray;
use crate::window_positions::{spawn_position_writer, PositionSender};
use crate::persistence::widget_state::{WidgetState, StoredPosition, StoredVisibility};
use crate::persistence::persistent_store::PersistentStore;
use std::error::Error;
use std::sync::Arc;
use std::fs;
use tauri::{App, Listener, Manager, PhysicalPosition, Position, WindowEvent};
use tokio_util::sync::CancellationToken;

type WidgetStore = PersistentStore<WidgetState>;

/// Clamp a position so the widget stays within the monitor's work area.
fn clamp_position(
    window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
) -> (i32, i32) {
    let monitor = match window.current_monitor() {
        Ok(Some(m)) => Some(m),
        _ => window.primary_monitor().ok().flatten(),
    };
    let Some(monitor) = monitor else { return (x, y) };
    let Ok(window_size) = window.outer_size() else { return (x, y) };
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

    let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");

    // Database connections
    let rw_db = DbState::open(&app_data_dir).expect("failed to open read‑write DB");
    let ro_db = ReadOnlyDb::open(&app_data_dir).expect("failed to open read‑only DB");
    app.manage(rw_db.clone());
    app.manage(ro_db);

    let cancel_token = CancellationToken::new();
    let task_token = cancel_token.clone();
    app.manage(cancel_token.clone());

    start_sampler(monitor_state, rw_db, ping_state, task_token);

    let app_handle = app.handle();

    // --- Single merged widget state store ---
    let widget_store = Arc::new(WidgetStore::new("widget-state.json"));
    app.manage(widget_store.clone());

    // --- Migrate from old separate files if they exist ---
    let old_pos_path = app_data_dir.join("widget-positions.json");
    let old_vis_path = app_data_dir.join("widget-visibility.json");
    let new_path = app_data_dir.join("widget-state.json");
    if !new_path.exists() && (old_pos_path.exists() || old_vis_path.exists()) {
        tracing::info!("Migrating old widget settings to new merged file");
        let mut state = WidgetState::default();
        if old_pos_path.exists() {
            if let Ok(contents) = fs::read_to_string(&old_pos_path) {
                if let Ok(positions) = serde_json::from_str::<std::collections::BTreeMap<String, StoredPosition>>(&contents) {
                    state.positions = positions;
                }
            }
        }
        if old_vis_path.exists() {
            if let Ok(contents) = fs::read_to_string(&old_vis_path) {
                if let Ok(visibility) = serde_json::from_str::<std::collections::BTreeMap<String, StoredVisibility>>(&contents) {
                    state.visibility = visibility;
                }
            }
        }
        widget_store.update(&app_handle, |s| *s = state);
        // Optionally delete old files
        let _ = fs::remove_file(old_pos_path);
        let _ = fs::remove_file(old_vis_path);
    }

    // Load the store from disk (or newly migrated)
    widget_store.load(&app_handle);

    // Spawn debounced position writer
    let pos_sender = spawn_position_writer(app_handle.clone(), widget_store.clone());
    app.manage(pos_sender);

    // --- Widget windows: position & visibility after page load ---
    for label in ["pill", "compact", "hud"] {
        if let Some(window) = app.get_webview_window(label) {
            let window_clone = window.clone();
            let label_str = label.to_string();
            let store = widget_store.clone();

            window.listen("tauri://page-load", move |_| {
                let state = store.read(|s| s.clone());
                // Restore position
                if let Some(pos) = state.positions.get(&label_str) {
                    let (clamped_x, clamped_y) = clamp_position(&window_clone, pos.x, pos.y);
                    let _ = window_clone.set_position(Position::Physical(PhysicalPosition {
                        x: clamped_x,
                        y: clamped_y,
                    }));
                }
                // Restore visibility
                let visible = state.visibility.get(&label_str).map(|v| v.visible).unwrap_or(true);
                if visible {
                    let _ = window_clone.show();
                } else {
                    let _ = window_clone.hide();
                }
            });

            // Handle close/destroy -> hide and save visibility
            let window_clone2 = window.clone();
            let app_handle_clone2 = app_handle.clone();
            let label_str2 = label.to_string();
            let store2 = widget_store.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone2.hide();
                    store2.update(&app_handle_clone2, |s| s.set_visibility(&label_str2, false));
                } else if let WindowEvent::Destroyed = event {
                    store2.update(&app_handle_clone2, |s| s.set_visibility(&label_str2, false));
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

    build_tray(app.handle().clone(), cancel_token)?;
    Ok(())
}