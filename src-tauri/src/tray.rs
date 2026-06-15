use crate::commands::network::APP_SHUTTING_DOWN;
use crate::commands::visibility::apply_widget_visibility;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use crate::theme; // <-- uses your theme.rs
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{ Instant};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindowBuilder};
use tokio_util::sync::CancellationToken;

type WidgetStore = PersistentStore<WidgetState>;

/// Program-start epoch for converting Instant to u64 nanoseconds.
static EPOCH: OnceLock<Instant> = OnceLock::new();
/// Nanoseconds since EPOCH of the last accepted tray left-click.
static LAST_TRAY_CLICK_NS: AtomicU64 = AtomicU64::new(0);

fn monotonic_now_ns() -> u64 {
    let epoch = EPOCH.get_or_init(Instant::now);
    epoch.elapsed().as_nanos() as u64
}

const DEBOUNCE_NS: u64 = 300_000_000; // 300 ms

// ── Tray builder ──────────────────────────────────────────────────────────────

pub fn build_tray(app_handle: AppHandle) -> tauri::Result<()> {
    let app = app_handle.app_handle();
    let store = app_handle.state::<Arc<WidgetStore>>().inner().clone();

    let is_light = theme::is_system_light_theme();
    let icon = theme::tray_icon_for_theme(is_light)?;

    let quit = MenuItem::with_id(app, "quit", "Quit FluxNet", true, None::<&str>)?;
    let toggle_pill = MenuItem::with_id(app, "toggle_pill", "Toggle Pill", true, None::<&str>)?;
    let toggle_compact =
        MenuItem::with_id(app, "toggle_compact", "Toggle Compact", true, None::<&str>)?;
    let toggle_hud = MenuItem::with_id(app, "toggle_hud", "Toggle HUD", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &dashboard,
            &toggle_pill,
            &toggle_compact,
            &toggle_hud,
            &quit,
        ],
    )?;

    let store_clone = store.clone();

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(false)
        .menu(&menu)
        .tooltip("FluxNet")
        .on_menu_event(move |app_handle, event| match event.id.as_ref() {
            "quit" => {
                let cancel_token = app_handle
                    .try_state::<CancellationToken>()
                    .expect("cancel_token not in app state")
                    .clone();
                let store = app_handle.state::<Arc<WidgetStore>>().clone();
                perform_shutdown(app_handle, &cancel_token, &store);
            }
            "toggle_pill" => toggle_widget(app_handle, &store_clone, "pill"),
            "toggle_compact" => toggle_widget(app_handle, &store_clone, "compact"),
            "toggle_hud" => toggle_widget(app_handle, &store_clone, "hud"),
            "dashboard" => open_dashboard(app_handle),
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event
            {
                let now = monotonic_now_ns();
                let last = LAST_TRAY_CLICK_NS.load(Ordering::Relaxed);
                if now.saturating_sub(last) < DEBOUNCE_NS {
                    return;
                }
                LAST_TRAY_CLICK_NS.store(now, Ordering::Relaxed);

                let app = tray.app_handle();
                open_dashboard(app);
            }
        })
        .build(app)?;

    // Spawn theme watcher from your theme.rs module
    theme::spawn_theme_watcher(app_handle.clone(), tray.id().clone());

    Ok(())
}

/// Helper to toggle a widget’s visibility.
fn toggle_widget(app_handle: &AppHandle, store: &Arc<WidgetStore>, widget_id: &str) {
    let visible = app_handle
        .get_webview_window(widget_id)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    let _ = apply_widget_visibility(app_handle, store, widget_id, !visible);
}

// ── Dashboard helper ──────────────────────────────────────────────────────────

pub fn open_dashboard(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    } else {
        tracing::warn!("Main window not found – recreating");
        let _ = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
            .title("FluxNet")
            .inner_size(900.0, 600.0)
            .min_inner_size(720.0, 500.0)
            .decorations(true)
            .resizable(true)
            .visible(true)
            .center()
            .build();
    }
}

/// Gracefully shut down FluxNet: cancel sampler, save widget states, exit.
pub fn perform_shutdown(
    app_handle: &AppHandle,
    cancel_token: &CancellationToken,
    widget_store: &Arc<WidgetStore>,
) {
    APP_SHUTTING_DOWN.store(true, std::sync::atomic::Ordering::SeqCst);

    // Save current widget states (visibility & position)
    widget_store.update(app_handle, |state| {
        for label in crate::commands::network::WIDGET_LABELS {
            if let Some(w) = app_handle.get_webview_window(label) {
                let vis = w.is_visible().unwrap_or(false);
                state.set_visibility(label, vis);
                if let Ok(pos) = w.outer_position() {
                    state.positions.insert(
                        label.to_string(),
                        crate::persistence::widget_state::StoredPosition { x: pos.x, y: pos.y },
                    );
                }
            }
        }
    });

    tracing::info!("Full shutdown initiated – cancelling sampler");
    cancel_token.cancel();

    // Give a moment for cleanup, then exit
    let app_handle = app_handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(1000));
        app_handle.exit(0);
    });
}
