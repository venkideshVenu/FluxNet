use crate::app_windows;
use crate::commands::network::APP_SHUTTING_DOWN;
use crate::commands::visibility::apply_widget_visibility;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use crate::theme;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Instant;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use tokio_util::sync::CancellationToken;

type WidgetStore = PersistentStore<WidgetState>;

static EPOCH: OnceLock<Instant> = OnceLock::new();
static LAST_TRAY_CLICK_NS: AtomicU64 = AtomicU64::new(0);

fn monotonic_now_ns() -> u64 {
    let epoch = EPOCH.get_or_init(Instant::now);
    epoch.elapsed().as_nanos() as u64
}

const DEBOUNCE_NS: u64 = 300_000_000;

pub fn build_tray(app_handle: AppHandle) -> tauri::Result<()> {
    let app = app_handle.app_handle();

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

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(false)
        .menu(&menu)
        .tooltip("FluxNet")
        .on_menu_event(move |app_handle, event| match event.id.as_ref() {
            "quit" => {
                let cancel_token = match app_handle.try_state::<CancellationToken>() {
                    Some(t) => t.clone(),
                    None => {
                        tracing::error!("CancellationToken missing on quit, forcing exit");
                        app_handle.exit(1);
                        return;
                    }
                };
                let store = match app_handle.try_state::<Arc<WidgetStore>>() {
                    Some(s) => s.inner().clone(),
                    None => {
                        tracing::error!("WidgetStore missing on quit, forcing exit");
                        app_handle.exit(1);
                        return;
                    }
                };
                perform_shutdown(app_handle, &cancel_token, &store);
            }
            "toggle_pill" => toggle_widget(app_handle, "pill"),
            "toggle_compact" => toggle_widget(app_handle, "compact"),
            "toggle_hud" => toggle_widget(app_handle, "hud"),
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

    theme::spawn_theme_watcher(app_handle.clone(), tray.id().clone());

    Ok(())
}

fn toggle_widget(app_handle: &AppHandle, widget_id: &str) {
    let store = match app_handle.try_state::<Arc<WidgetStore>>() {
        Some(s) => s.inner().clone(),
        None => {
            tracing::warn!("WidgetStore not available yet for toggle");
            return;
        }
    };

    let visible = app_handle
        .get_webview_window(widget_id)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    let _ = apply_widget_visibility(app_handle, &store, widget_id, !visible);
}

pub fn open_dashboard(app: &AppHandle) {
    app_windows::open_dashboard(app);
}

pub fn perform_shutdown(
    app_handle: &AppHandle,
    cancel_token: &CancellationToken,
    widget_store: &Arc<WidgetStore>,
) {
    APP_SHUTTING_DOWN.store(true, std::sync::atomic::Ordering::SeqCst);

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

    let app_handle = app_handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(1000));
        app_handle.exit(0);
    });
}
