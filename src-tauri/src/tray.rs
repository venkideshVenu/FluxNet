use crate::commands::visibility::apply_widget_visibility;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::WidgetState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
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

const DEBOUNCE_NS: u64 = 300_000_000; // 300 ms in nanoseconds

// ── Tray builder ──────────────────────────────────────────────────────────────

pub fn build_tray(app_handle: AppHandle, cancel_token: CancellationToken) -> tauri::Result<()> {
    let app = app_handle.app_handle();
    let store = app_handle.state::<Arc<WidgetStore>>().inner().clone();

    let quit        = MenuItem::with_id(app, "quit",         "Quit FluxNet",          true, None::<&str>)?;
    let show_pill   = MenuItem::with_id(app, "show_pill",    "Show widget",            true, None::<&str>)?;
    let hide_pill   = MenuItem::with_id(app, "hide_pill",    "Hide widget",            true, None::<&str>)?;
    let show_compact= MenuItem::with_id(app, "show_compact", "Show compact widget",    true, None::<&str>)?;
    let hide_compact= MenuItem::with_id(app, "hide_compact", "Hide compact widget",    true, None::<&str>)?;
    let show_hud    = MenuItem::with_id(app, "show_hud",     "Show HUD",               true, None::<&str>)?;
    let hide_hud    = MenuItem::with_id(app, "hide_hud",     "Hide HUD",               true, None::<&str>)?;
    let dashboard   = MenuItem::with_id(app, "dashboard",    "Open dashboard",         true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &dashboard,
            &show_pill, &hide_pill,
            &show_compact, &hide_compact,
            &show_hud, &hide_hud,
            &quit,
        ],
    )?;

    let token = cancel_token.clone();
    let store_clone = store.clone();

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app_handle, event| {
            match event.id.as_ref() {
                "quit" => {
                    token.cancel();

                    let app_h = app_handle.clone();
                    std::thread::spawn(move || {
                        // 1.5 s is enough for the checkpoint std::thread to complete
                        // (started inside the sampler cancel arm).
                        std::thread::sleep(Duration::from_millis(1_500));
                        app_h.exit(0);
                    });
                }
                "show_pill"    => { let _ = apply_widget_visibility(app_handle, &store_clone, "pill",    true);  }
                "hide_pill"    => { let _ = apply_widget_visibility(app_handle, &store_clone, "pill",    false); }
                "show_compact" => { let _ = apply_widget_visibility(app_handle, &store_clone, "compact", true);  }
                "hide_compact" => { let _ = apply_widget_visibility(app_handle, &store_clone, "compact", false); }
                "show_hud"     => { let _ = apply_widget_visibility(app_handle, &store_clone, "hud",     true);  }
                "hide_hud"     => { let _ = apply_widget_visibility(app_handle, &store_clone, "hud",     false); }
                "dashboard"    => { open_dashboard(app_handle); }
                _ => {}
            }
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                // FIX W6: monotonic Instant comparison — immune to clock adjustments
                let now = monotonic_now_ns();
                let last = LAST_TRAY_CLICK_NS.load(Ordering::Relaxed);
                if now.saturating_sub(last) < DEBOUNCE_NS {
                    return;
                }
                LAST_TRAY_CLICK_NS.store(now, Ordering::Relaxed);

                let app = tray.app_handle();
                let store = app.state::<Arc<WidgetStore>>().inner().clone();
                if let Some(w) = app.get_webview_window("pill") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = apply_widget_visibility(&app, &store, "pill", false);
                    } else {
                        let _ = apply_widget_visibility(&app, &store, "pill", true);
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

// ── Dashboard helper ──────────────────────────────────────────────────────────

pub fn open_dashboard(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    } else {
        // FIX W4: log as error (this path should never happen), and add
        // .visible(true) so the window actually appears when built at runtime.
        tracing::error!("Main window not found — recreating it (this should not happen)");
        let _ = WebviewWindowBuilder::new(
            app,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("FluxNet")
        .inner_size(900.0, 600.0)
        .min_inner_size(720.0, 500.0)
        .decorations(true)
        .resizable(true)
        .visible(true) // FIX W4: was missing — Tauri 2 windows start hidden
        .center()
        .build();
    }
}