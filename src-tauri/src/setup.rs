use crate::background::sampler::start_sampler;
use crate::commands::network::{
    InterfacesCache, SharedInterfacesCache, SharedMonitorState, APP_SHUTTING_DOWN,
};
use crate::commands::ping::SharedPingState;
use crate::persistence::app_settings::SettingsStore;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::{StoredPosition, StoredVisibility, WidgetState};
use crate::storage::db::{DbState, ReadOnlyDb};
use crate::tray::build_tray;
use crate::window_positions::{spawn_position_writer, PositionSender};
use parking_lot::Mutex;
use std::error::Error;
use std::fs;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{App, Listener, Manager, PhysicalPosition, Position, WindowEvent};
use tokio_util::sync::CancellationToken;

type WidgetStore = PersistentStore<WidgetState>;

fn clamp_position(window: &tauri::WebviewWindow, x: i32, y: i32) -> (i32, i32) {
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
    let wa = monitor.work_area();
    let left = wa.position.x;
    let right = wa.position.x + wa.size.width as i32;
    let top = wa.position.y;
    let bottom = wa.position.y + wa.size.height as i32;
    (
        x.clamp(left, (right - window_size.width as i32).max(left)),
        y.clamp(top, (bottom - window_size.height as i32).max(top)),
    )
}

fn migrate_legacy_widget_files(
    app_data_dir: &std::path::Path,
    widget_store: &Arc<WidgetStore>,
    app_handle: &tauri::AppHandle,
) {
    let old_pos_path = app_data_dir.join("widget-positions.json");
    let old_vis_path = app_data_dir.join("widget-visibility.json");
    let new_path = app_data_dir.join("widget-state.json");

    if new_path.exists() || (!old_pos_path.exists() && !old_vis_path.exists()) {
        return;
    }

    tracing::info!("Migrating old widget settings to new merged file");
    let mut state = WidgetState::default();

    if let Ok(contents) = fs::read_to_string(&old_pos_path) {
        if let Ok(positions) =
            serde_json::from_str::<std::collections::HashMap<String, StoredPosition>>(&contents)
        {
            state.positions = positions;
        }
    }
    if let Ok(contents) = fs::read_to_string(&old_vis_path) {
        if let Ok(visibility) =
            serde_json::from_str::<std::collections::HashMap<String, StoredVisibility>>(&contents)
        {
            for (label, sv) in visibility {
                state.configs.entry(label).or_default().visible = sv.visible;
            }
        }
    }

    widget_store.update(app_handle, |s| *s = state);
    let _ = fs::remove_file(&old_pos_path);
    let _ = fs::remove_file(&old_vis_path);
}

fn wire_widget_windows(app: &App, widget_store: Arc<WidgetStore>, app_handle: tauri::AppHandle) {
    let pos_sender = app.state::<PositionSender>();

    for label in ["pill", "compact", "hud"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };

        // Page-load: restore position, visibility, always_on_top
        {
            let window_cl = window.clone();
            let label_str = label.to_string();
            let store = widget_store.clone();

            window.once("tauri://page-load", move |_| {
                let state = store.read(|s| s.clone());

                if let Some(pos) = state.positions.get(&label_str) {
                    let (cx, cy) = clamp_position(&window_cl, pos.x, pos.y);
                    let _ = window_cl
                        .set_position(Position::Physical(PhysicalPosition { x: cx, y: cy }));
                }

                let cfg = state.get_config(&label_str);
                let _ = window_cl.set_always_on_top(cfg.always_on_top);

                if cfg.visible {
                    let _ = window_cl.show();
                } else {
                    let _ = window_cl.hide();
                }
            });
        }

        // Close / Destroy
        {
            let window_cl = window.clone();
            let app_h = app_handle.clone();
            let label_str = label.to_string();
            let store = widget_store.clone();
            let sender = pos_sender.0.clone();

            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_cl.hide();

                        if let Ok(pos) = window_cl.outer_position() {
                            sender.push(label_str.clone(), pos);
                        }

                        // Only save visibility=false if NOT shutting down.
                        // On quit, the tray handler saves the correct state.
                        if !APP_SHUTTING_DOWN.load(Ordering::SeqCst) {
                            store.update(&app_h, |s| s.set_visibility(&label_str, false));
                        }
                    }
                    WindowEvent::Destroyed => {
                        if !APP_SHUTTING_DOWN.load(Ordering::SeqCst) {
                            store.update(&app_h, |s| s.set_visibility(&label_str, false));
                        }
                    }
                    _ => {}
                }
            });
        }
    }
}

fn wire_main_window(app: &App) {
    if let Some(main_window) = app.get_webview_window("main") {
        let main_cl = main_window.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = main_cl.hide();
            }
        });
    }
}

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let monitor_state = app.state::<SharedMonitorState>().inner().clone();
    let ping_state = app.state::<SharedPingState>().inner().clone();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    let rw_db = DbState::open(&app_data_dir).expect("failed to open read-write DB");
    let ro_db = ReadOnlyDb::open(&app_data_dir).expect("failed to open read-only DB");
    app.manage(rw_db.clone());
    app.manage(ro_db);

    let iface_cache: SharedInterfacesCache = Arc::new(Mutex::new(InterfacesCache::default()));
    app.manage(iface_cache);

    let cancel_token = CancellationToken::new();
    let task_token = cancel_token.clone();

    let app_handle = app.handle().clone();

    let settings_store = Arc::new(SettingsStore::new("app-settings.json"));
    settings_store.load(&app_handle);
    app.manage(settings_store.clone());

    let sampler_handle = start_sampler(
        monitor_state,
        rw_db,
        ping_state,
        task_token,
        settings_store,
        app_handle.clone(),
    );
    app.manage(sampler_handle);

    let widget_store = Arc::new(WidgetStore::new("widget-state.json"));
    app.manage(widget_store.clone());

    migrate_legacy_widget_files(&app_data_dir, &widget_store, &app_handle);
    widget_store.load(&app_handle);
    widget_store.update(&app_handle, |s| s.migrate_legacy());

    let pos_sender = spawn_position_writer(app_handle.clone(), widget_store.clone());
    app.manage(pos_sender);

    wire_widget_windows(app, widget_store, app_handle.clone());
    wire_main_window(app);

    build_tray(app_handle, cancel_token)?;

    Ok(())
}
