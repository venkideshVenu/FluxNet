//! On-demand lifecycle for the app's webview windows.
//!
//! Every window is declared in `tauri.conf.json` with `"create": false`, so no
//! WebView2 renderer exists until the window is actually needed. Widgets are
//! destroyed (not hidden) when turned off, and the dashboard is destroyed when
//! it is closed to the tray. Each destroyed window gives back its renderer
//! process memory instead of keeping it alive while invisible.
//!
//! Windows must not be created from a synchronous Tauri command or event
//! handler on Windows (it deadlocks), so callers of [`get_or_create`] are
//! `async` commands or run on a spawned task (see [`spawn_on_app`]).

use crate::appearance;
use crate::commands::network::{APP_SHUTTING_DOWN, WIDGET_LABELS, is_widget_label};
use crate::commands::visibility::hud_size_for_design;
use crate::placement::{self, Display, Rect};
use crate::theme;
use crate::window_positions::{PositionSender, WidgetStore};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::Ordering;
use std::sync::{Arc, LazyLock};
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size,
    WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

pub const MAIN_LABEL: &str = "main";

/// Event emitted to every window whenever a widget is turned on or off.
pub const WIDGET_VISIBILITY_EVENT: &str = "widget-visibility-changed";

#[derive(Clone, Serialize)]
pub struct WidgetVisibilityPayload {
    pub label: String,
    pub visible: bool,
}

pub fn emit_widget_visibility(app: &AppHandle, label: &str, visible: bool) {
    let _ = app.emit(
        WIDGET_VISIBILITY_EVENT,
        WidgetVisibilityPayload {
            label: label.to_string(),
            visible,
        },
    );
}

/// Serialises window creation so two concurrent requests for the same label
/// (double-click, tray + dashboard) can't both try to build it.
static CREATE_LOCK: Mutex<()> = Mutex::new(());

/// Labels whose window has been asked to destroy itself but is still
/// registered with Tauri until its `Destroyed` event is processed.
static CLOSING: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(Default::default);

/// Runs `f` on the async runtime, off the main thread. Use from tray/menu
/// handlers and plugin callbacks that may create windows.
pub fn spawn_on_app<F>(app: &AppHandle, f: F)
where
    F: FnOnce(&AppHandle) + Send + 'static,
{
    let app = app.clone();
    tauri::async_runtime::spawn(async move { f(&app) });
}

/// Waits (briefly) for a window that is being destroyed to finish, so it is
/// not handed out again. Must not be called on the main thread.
fn wait_until_closed(label: &str) {
    for _ in 0..100 {
        if !CLOSING.lock().contains(label) {
            return;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    tracing::warn!("'{label}' window did not finish closing within 1 s");
    CLOSING.lock().remove(label);
}

/// Returns the window for `label`, creating it from its config entry if it
/// does not exist yet. Newly created windows start hidden.
pub fn get_or_create(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let _creating = CREATE_LOCK.lock();
    wait_until_closed(label);

    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == label)
        .ok_or_else(|| format!("no window config for '{label}'"))?;

    let mut builder = WebviewWindowBuilder::from_config(app, config)
        .map_err(|e| format!("failed to configure '{label}' window: {e}"))?;
    if label == MAIN_LABEL {
        builder = appearance::with_backdrop(builder);
    }
    if let Some(script) = theme::system_theme_init_script() {
        builder = builder.initialization_script(script);
    }
    let window = builder
        .build()
        .map_err(|e| format!("failed to create '{label}' window: {e}"))?;

    tracing::info!("Created '{label}' window");

    if is_widget_label(label) {
        prepare_widget(app, &window, label);
    } else if label == MAIN_LABEL {
        prepare_main(&window);
    }

    Ok(window)
}

/// Shows (creating if needed) and focuses the dashboard window.
pub fn open_dashboard(app: &AppHandle) {
    match get_or_create(app, MAIN_LABEL) {
        Ok(window) => {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        Err(e) => tracing::error!("Could not open dashboard: {e}"),
    }
}

/// Destroys a widget window, recording its last position first.
pub fn destroy_widget(app: &AppHandle, label: &str) -> Result<(), String> {
    let Some(window) = app.get_webview_window(label) else {
        return Ok(());
    };
    if let (Some(sender), Ok(pos)) = (app.try_state::<PositionSender>(), window.outer_position()) {
        sender.0.push(label.to_string(), pos);
    }
    CLOSING.lock().insert(label.to_string());
    if let Err(e) = window.destroy() {
        CLOSING.lock().remove(label);
        return Err(e.to_string());
    }
    tracing::info!("Destroyed '{label}' window");
    Ok(())
}

/// A size a widget reported for its content (see `fit_widget_window`): in
/// physical pixels, with the window's scale factor when it was measured.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FittedSize {
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

impl FittedSize {
    /// The same size on a monitor with another scale factor.
    pub fn at_scale(self, scale: f64) -> (u32, u32) {
        let ratio = if self.scale > 0.0 {
            scale / self.scale
        } else {
            1.0
        };
        (
            (f64::from(self.width) * ratio).ceil() as u32,
            (f64::from(self.height) * ratio).ceil() as u32,
        )
    }
}

/// Sizes the widgets reported for their content. They replace the starting
/// estimates below.
static FITTED_SIZES: LazyLock<Mutex<HashMap<String, FittedSize>>> = LazyLock::new(Default::default);

pub fn remember_fitted_size(label: &str, size: FittedSize) {
    FITTED_SIZES.lock().insert(label.to_string(), size);
}

fn fitted_size(label: &str) -> Option<FittedSize> {
    FITTED_SIZES.lock().get(label).copied()
}

pub fn forget_fitted_size(label: &str) {
    FITTED_SIZES.lock().remove(label);
}

/// Logical size a widget window should have: the size its content last
/// reported, or an estimate until it has.
pub fn widget_logical_size(app: &AppHandle, label: &str) -> Option<(f64, f64)> {
    if let Some(size) = fitted_size(label) {
        return Some((
            f64::from(size.width) / size.scale,
            f64::from(size.height) / size.scale,
        ));
    }
    match label {
        "pill" => Some((200.0, 32.0)),
        "compact" => Some((168.0, 150.0)),
        "hud" => {
            let design = app
                .try_state::<Arc<WidgetStore>>()
                .map(|s| s.read(|state| state.get_hud_design().to_string()))
                .unwrap_or_default();
            Some(hud_size_for_design(&design))
        }
        _ => None,
    }
}

/// Locks a window to a fixed logical size.
pub fn lock_logical_size(window: &WebviewWindow, width: f64, height: f64) {
    lock_size(window, Size::Logical(LogicalSize { width, height }));
}

/// Locks a window to a fixed size in physical pixels.
pub fn lock_physical_size(window: &WebviewWindow, width: u32, height: u32) {
    lock_size(window, Size::Physical(PhysicalSize { width, height }));
}

fn lock_size(window: &WebviewWindow, size: Size) {
    // Clear the old bounds first: when growing, a new minimum larger than the
    // old maximum would otherwise be rejected or clamped.
    let _ = window.set_max_size(None::<Size>);
    let _ = window.set_min_size(Some(size));
    let _ = window.set_max_size(Some(size));
    let _ = window.set_size(size);
}

// ── Dashboard setup ───────────────────────────────────────────────────────────

/// While the dashboard is minimized, ask WebView2 to keep its memory use low.
/// WebView2 then trims the renderer's working set; it is restored to normal
/// as soon as the window comes back.
fn prepare_main(window: &WebviewWindow) {
    #[cfg(windows)]
    {
        use std::sync::atomic::AtomicBool;

        let minimized = Arc::new(AtomicBool::new(false));
        let window_for_events = window.clone();
        window.on_window_event(move |event| {
            if !matches!(event, WindowEvent::Resized(_)) {
                return;
            }
            let now_minimized = window_for_events.is_minimized().unwrap_or(false);
            if minimized.swap(now_minimized, Ordering::Relaxed) != now_minimized {
                set_low_memory_target(&window_for_events, now_minimized);
            }
        });
    }
    #[cfg(not(windows))]
    let _ = window;
}

/// Sets the WebView2 memory usage target level (`ICoreWebView2_19`).
/// Older WebView2 runtimes without this interface are left untouched.
#[cfg(windows)]
fn set_low_memory_target(window: &WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        ICoreWebView2_19,
    };
    use windows_core::Interface;

    let label = window.label().to_string();
    let level = if low {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
    } else {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
    };
    let result = window.with_webview(move |webview| {
        let applied = unsafe { webview.controller().CoreWebView2() }
            .and_then(|core| core.cast::<ICoreWebView2_19>())
            .and_then(|core| unsafe { core.SetMemoryUsageTargetLevel(level) });
        match applied {
            Ok(()) => tracing::debug!("'{label}' WebView2 memory target low={low}"),
            Err(e) => tracing::debug!("'{label}' WebView2 memory target unavailable: {e}"),
        }
    });
    if let Err(e) = result {
        tracing::debug!("with_webview failed: {e}");
    }
}

// ── Widget setup ──────────────────────────────────────────────────────────────

fn prepare_widget(app: &AppHandle, window: &WebviewWindow, label: &str) {
    if let Some((w, h)) = widget_logical_size(app, label) {
        lock_logical_size(window, w, h);
    }

    if let Some(store) = app.try_state::<Arc<WidgetStore>>() {
        let (position, config) =
            store.read(|s| (s.positions.get(label).copied(), s.get_config(label)));

        if let Some((x, y)) = initial_position(app, label, position.map(|p| (p.x, p.y))) {
            tracing::info!("Placing '{label}' at ({x}, {y}) (saved={position:?})");
            let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
        }
        let _ = window.set_always_on_top(config.always_on_top);
    }

    let app_handle = app.clone();
    let label = label.to_string();
    let window_for_events = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::ScaleFactorChanged { .. } => {
            // Moving between monitors with different DPI (or changing Windows
            // display scaling) leaves the min/max lock at the old physical
            // size. Scale it to the new monitor; the widget then measures
            // itself again and reports the exact size.
            match fitted_size(&label) {
                Some(fitted) => {
                    let scale = window_for_events.scale_factor().unwrap_or(fitted.scale);
                    let (w, h) = fitted.at_scale(scale);
                    lock_physical_size(&window_for_events, w, h);
                }
                None => {
                    if let Some((w, h)) = widget_logical_size(&app_handle, &label) {
                        lock_logical_size(&window_for_events, w, h);
                    }
                }
            }
        }
        WindowEvent::CloseRequested { .. } => {
            // The user closed the widget itself (e.g. Alt+F4): let the close
            // go ahead, keep its position, and record it as turned off.
            CLOSING.lock().insert(label.clone());
            if let (Some(sender), Ok(pos)) = (
                app_handle.try_state::<PositionSender>(),
                window_for_events.outer_position(),
            ) {
                sender.0.push(label.clone(), pos);
            }
            if !APP_SHUTTING_DOWN.load(Ordering::SeqCst) {
                if let Some(store) = app_handle.try_state::<Arc<WidgetStore>>() {
                    store.update(&app_handle, |s| s.set_visibility(&label, false));
                }
                emit_widget_visibility(&app_handle, &label, false);
            }
        }
        WindowEvent::Destroyed => {
            // Visibility is persisted by whoever turned the widget off; a late
            // Destroyed event must not overwrite a newer "on".
            CLOSING.lock().remove(&label);
        }
        _ => {}
    });
}

/// Snapshot of the connected monitors' work areas for [`placement`].
fn displays(app: &AppHandle) -> (Vec<Display>, usize) {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary_pos = app.primary_monitor().ok().flatten().map(|m| *m.position());
    let primary = monitors
        .iter()
        .position(|m| Some(*m.position()) == primary_pos)
        .unwrap_or(0);
    let displays = monitors
        .iter()
        .map(|m| {
            let wa = m.work_area();
            Display {
                bounds: Rect {
                    x: m.position().x,
                    y: m.position().y,
                    width: m.size().width,
                    height: m.size().height,
                },
                work: Rect {
                    x: wa.position.x,
                    y: wa.position.y,
                    width: wa.size.width,
                    height: wa.size.height,
                },
                scale: m.scale_factor(),
            }
        })
        .collect();
    (displays, primary)
}

/// Saved position (kept on the monitor it was on, or moved to the nearest one
/// if that monitor is gone), or a resolution-aware default on first run.
fn initial_position(app: &AppHandle, label: &str, saved: Option<(i32, i32)>) -> Option<(i32, i32)> {
    let (logical_w, logical_h) = widget_logical_size(app, label)?;
    let (displays, primary) = displays(app);
    match saved {
        Some((x, y)) => placement::restore_position(&displays, primary, x, y, logical_w, logical_h),
        None => {
            let slot = WIDGET_LABELS.iter().position(|l| *l == label).unwrap_or(0);
            placement::default_position(&displays, primary, slot, logical_w, logical_h)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::FittedSize;

    #[test]
    fn fitted_sizes_follow_the_monitor_scale() {
        let at_125 = FittedSize {
            width: 275,
            height: 35,
            scale: 1.25,
        };
        assert_eq!(at_125.at_scale(1.25), (275, 35));
        assert_eq!(at_125.at_scale(1.0), (220, 28));
        assert_eq!(at_125.at_scale(1.5), (330, 42));
    }
}
