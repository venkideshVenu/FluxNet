use crate::app_windows;
use crate::background::sampler::start_sampler;
use crate::commands::network::AUTOMATIC_INTERFACE;
use crate::commands::network::{
    InterfacesCache, SharedInterfacesCache, SharedMonitorState, WIDGET_LABELS,
};
use crate::commands::ping::SharedPingState;
use crate::persistence::app_settings::SettingsStore;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use crate::persistence::widget_state::{StoredPosition, StoredVisibility};
use crate::storage::db::{DbState, ReadOnlyDb};
use crate::tray::build_tray;
use crate::window_positions::spawn_position_writer;
use parking_lot::Mutex;
use std::error::Error;
use std::fs;
use std::sync::Arc;
use tauri::{App, AppHandle, Manager};
use tokio_util::sync::CancellationToken;
type WidgetStore = PersistentStore<WidgetState>;

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

// ── Restore widgets and the dashboard ────────────────────────────────────────

/// Creates and shows only the widgets that were visible at last quit. Widgets
/// that are off get no window (and no WebView2 renderer) until turned on.
fn restore_visible_widgets(app: &AppHandle, widget_store: &Arc<WidgetStore>) {
    let state = widget_store.read(|s| s.clone());
    tracing::info!(
        "Restoring widget states: configs={:?}, positions={:?}",
        state.configs,
        state.positions
    );

    for label in WIDGET_LABELS {
        if !state.get_config(label).visible {
            continue;
        }
        match app_windows::get_or_create(app, label) {
            Ok(window) => {
                tracing::info!("Showing widget '{label}' (was visible at last quit)");
                let _ = window.show();
            }
            Err(e) => tracing::error!("Could not restore widget '{label}': {e}"),
        }
    }
}

fn open_main_window_unless_autostart(app: &AppHandle) {
    let is_autostart = std::env::args().any(|a| a == "--autostart" || a == "--minimized");
    if is_autostart {
        tracing::info!("Autostart launch detected — dashboard not created");
    } else {
        app_windows::open_dashboard(app);
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
    let rw_db = DbState::open_or_recover(&app_data_dir).expect("failed to open read-write DB");
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

    // A manually chosen adapter survives restarts; otherwise the sampler
    // picks one automatically.
    if let Some(name) = settings_store.read(|s| s.manual_interface.clone()) {
        tracing::info!("Using the adapter chosen in settings: {name}");
        AUTOMATIC_INTERFACE.store(false, std::sync::atomic::Ordering::Relaxed);
        monitor_state.lock().interface = name;
    }

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

    // ── Restore widgets that were visible, then the dashboard ────────────────
    restore_visible_widgets(&app_handle, &widget_store);
    open_main_window_unless_autostart(&app_handle);

    Ok(())
}
