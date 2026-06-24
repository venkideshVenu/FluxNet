use crate::background::sampler::start_sampler;
use crate::commands::network::{
    APP_SHUTTING_DOWN, InterfacesCache, SharedInterfacesCache, SharedMonitorState,
};
use crate::commands::ping::SharedPingState;
use crate::persistence::app_settings::SettingsStore;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use crate::persistence::widget_state::{StoredPosition, StoredVisibility};
use crate::storage::db::{DbState, ReadOnlyDb};
use crate::tray::build_tray;
use crate::window_positions::{PositionSender, spawn_position_writer};
use parking_lot::Mutex;
use std::error::Error;
use std::fs;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tauri::{App, Manager, PhysicalPosition, Position, WindowEvent};
use tokio_util::sync::CancellationToken;
type WidgetStore = PersistentStore<WidgetState>;

// ── Position clamping ─────────────────────────────────────────────────────────

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

// ── Migration: merge old separate files into widget-state.json ────────────────

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
    let mut positions = std::collections::HashMap::new();
    let mut visibility = std::collections::HashMap::new();

    if let Ok(contents) = fs::read_to_string(&old_pos_path) {
        let _ =
            serde_json::from_str::<std::collections::HashMap<String, StoredPosition>>(&contents)
                .map(|p| positions = p);
    }
    if let Ok(contents) = fs::read_to_string(&old_vis_path) {
        let _ =
            serde_json::from_str::<std::collections::HashMap<String, StoredVisibility>>(&contents)
                .map(|v| visibility = v);
    }

    widget_store.update(app_handle, |state| {
        state.positions.extend(positions);
        for (label, sv) in visibility {
            state.configs.entry(label).or_default().visible = sv.visible;
        }
    });

    let _ = fs::remove_file(&old_pos_path);
    let _ = fs::remove_file(&old_vis_path);
}

// ── Restore widget states IMMEDIATELY (no page-load dependency) ───────────────

fn restore_widget_states(app: &App, widget_store: &Arc<WidgetStore>) {
    let state = widget_store.read(|s| s.clone());

    tracing::info!(
        "Restoring widget states: configs={:?}, positions={:?}",
        state.configs,
        state.positions
    );

    for label in ["pill", "compact", "hud"] {
        let Some(window) = app.get_webview_window(label) else {
            tracing::warn!("Widget window '{label}' not found during restore");
            continue;
        };

        // 1. Restore position FIRST (before showing, so it appears in the right place)
        if let Some(pos) = state.positions.get(label) {
            let (cx, cy) = clamp_position(&window, pos.x, pos.y);
            tracing::info!("Restoring '{label}' position to ({cx}, {cy})");
            let _ = window.set_position(Position::Physical(PhysicalPosition { x: cx, y: cy }));
        }

        // 2. Restore always-on-top
        let cfg = state.get_config(label);
        let _ = window.set_always_on_top(cfg.always_on_top);

        // 3. Restore visibility
        if cfg.visible {
            tracing::info!("Showing widget '{label}' (was visible at last quit)");
            let _ = window.show();
        }
    }
}

/// Adjust widget window sizes based on the monitor's scale factor.
/// This ensures consistent physical pixel sizes across different DPI displays.
fn adjust_widget_sizes_for_dpi(app: &App) {
    let widget_sizes: &[(&str, f64, f64)] = &[("pill", 250.0, 32.0), ("compact", 189.0, 172.0)];

    for (label, logical_w, logical_h) in widget_sizes {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };

        let size = tauri::Size::Logical(tauri::LogicalSize {
            width: *logical_w,
            height: *logical_h,
        });

        let _ = window.set_size(size.clone());
        let _ = window.set_min_size(Some(size.clone()));
        let _ = window.set_max_size(Some(size));
    }

    // HUD: size depends on stored design preference
    if let Some(hud_window) = app.get_webview_window("hud") {
        let widget_store = app.state::<Arc<WidgetStore>>();
        let design = widget_store.read(|s| s.get_hud_design().to_string());

        let (w, h): (f64, f64) = if design == "vertical" {
            (130.0, 105.0)
        } else {
            (320.0, 36.0)
        };

        let size = tauri::Size::Logical(tauri::LogicalSize {
            width: w,
            height: h,
        });
        let _ = hud_window.set_size(size.clone());
        let _ = hud_window.set_min_size(Some(size.clone()));
        let _ = hud_window.set_max_size(Some(size));
    }
}

// ── Wire widget close/destroy event handlers ──────────────────────────────────

fn wire_widget_event_handlers(
    app: &App,
    widget_store: Arc<WidgetStore>,
    app_handle: tauri::AppHandle,
) {
    let pos_sender = app.state::<PositionSender>();

    for label in ["pill", "compact", "hud"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };

        let window_cl = window.clone();
        let app_h = app_handle.clone();
        let label_str = label.to_string();
        let store = widget_store.clone();
        let sender = pos_sender.0.clone();

        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window_cl.hide();

                if let Ok(pos) = window_cl.outer_position() {
                    sender.push(label_str.clone(), pos);
                }

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
        });
    }
}

// ── Main window wiring ────────────────────────────────────────────────────────

fn wire_main_window(app: &App) {
    if let Some(main_window) = app.get_webview_window("main") {
        let is_autostart = std::env::args().any(|a| a == "--autostart" || a == "--minimized");
        if is_autostart {
            tracing::info!("Autostart launch detected — main window stays hidden");
            let _ = main_window.hide();
        } else {
            let _ = main_window.show();
            let _ = main_window.set_focus();
        }
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let monitor_state = app.state::<SharedMonitorState>().inner().clone();
    let ping_state = app.state::<SharedPingState>().inner().clone();

    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");

    let app_handle = app.handle().clone();

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Manage ALL state FIRST, before any blocking work.
    // This ensures that if the webview loads instantly (bundled mode) and
    // invokes commands, try_state() will find them available.
    // ══════════════════════════════════════════════════════════════════════════

    // ── Database ──────────────────────────────────────────────────────────────
    let rw_db = DbState::open(&app_data_dir).expect("failed to open read-write DB");
    let ro_db = ReadOnlyDb::open(&app_data_dir).expect("failed to open read-only DB");
    app.manage(rw_db.clone());
    app.manage(ro_db);

    // ── Interfaces cache ──────────────────────────────────────────────────────
    let iface_cache: SharedInterfacesCache = Arc::new(Mutex::new(InterfacesCache::default()));
    app.manage(iface_cache);

    // ── Cancellation token ────────────────────────────────────────────────────
    let cancel_token = CancellationToken::new();
    app.manage(cancel_token.clone());

    // ── App settings ──────────────────────────────────────────────────────────
    let settings_store = Arc::new(SettingsStore::new("app-settings.json"));
    settings_store.load(&app_handle);
    app.manage(settings_store.clone());

    // ── Widget state store ────────────────────────────────────────────────────
    let widget_store = Arc::new(WidgetStore::new("widget-state.json"));
    widget_store.load(&app_handle);
    app.manage(widget_store.clone());

    // Migrate from legacy files (if present)
    migrate_legacy_widget_files(&app_data_dir, &widget_store, &app_handle);

    // Apply any internal migrations
    widget_store.update(&app_handle, |s| s.migrate_legacy());

    // ── Position debouncer ────────────────────────────────────────────────────
    let pos_sender = spawn_position_writer(app_handle.clone(), widget_store.clone());
    app.manage(pos_sender);

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: All state is managed. Now start blocking/async work.
    // Commands invoked by the webview will now find all state available.
    // ══════════════════════════════════════════════════════════════════════════

    // ── Start sampler (includes synchronous backfill) ─────────────────────────
    let task_token = cancel_token.clone();
    let sampler_handle = start_sampler(
        monitor_state,
        rw_db,
        ping_state,
        task_token,
        app_handle.clone(),
    );
    app.manage(sampler_handle);

    // ── System tray ───────────────────────────────────────────────────────────
    build_tray(app_handle.clone())?;

    // ── Wire event handlers ───────────────────────────────────────────────────
    wire_widget_event_handlers(app, widget_store.clone(), app_handle.clone());

    // ── Adjust widget sizes for display DPI ───────────────────────────────
    adjust_widget_sizes_for_dpi(app);

    // ── Restore widget positions and visibility ───────────────────────────────
    restore_widget_states(app, &widget_store);

    // ── Main window ───────────────────────────────────────────────────────────
    wire_main_window(app);

    Ok(())
}
