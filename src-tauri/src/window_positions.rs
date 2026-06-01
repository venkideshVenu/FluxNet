use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, PhysicalPosition, Position};

const WINDOW_POSITIONS_FILE: &str = "widget-positions.json";

/// How long to wait after the last Moved event before flushing to disk.
/// Windows fires Moved ~30-60x/sec during a drag; we only write once it stops.
const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);

/// Minimum distance from the screen edge we enforce when restoring a position.
/// Prevents widgets restored from a now-disconnected monitor being off-screen.
const SCREEN_MARGIN: i32 = 50;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
struct StoredWindowPosition {
    x: i32,
    y: i32,
}

type WindowPositions = BTreeMap<String, StoredWindowPosition>;

// ── Shared in-memory state ────────────────────────────────────────────────────
//
// Keeping the positions in memory means save_widget_position() never needs to
// read the file first — it just updates the map and schedules a debounced flush.
// This eliminates the load/save race and the per-event I/O.

struct PositionStore {
    positions:     WindowPositions,
    last_move_at:  Option<Instant>,  // when the last Moved event arrived
    needs_flush:   bool,             // true if the in-memory map is ahead of disk
}

impl PositionStore {
    fn new() -> Self {
        Self {
            positions:    WindowPositions::new(),
            last_move_at: None,
            needs_flush:  false,
        }
    }
}

// One global store shared across all window-event callbacks.
// Initialised lazily on first use; the AppHandle is not stored here.
static STORE: std::sync::OnceLock<Arc<Mutex<PositionStore>>> = std::sync::OnceLock::new();

fn get_store() -> Arc<Mutex<PositionStore>> {
    STORE.get_or_init(|| Arc::new(Mutex::new(PositionStore::new()))).clone()
}

// ── File I/O helpers ──────────────────────────────────────────────────────────

fn positions_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_POSITIONS_FILE))
}

fn load_positions_from_disk(app: &AppHandle) -> WindowPositions {
    let Some(path) = positions_path(app) else {
        return WindowPositions::new();
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return WindowPositions::new();
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

fn flush_to_disk(app: &AppHandle, positions: &WindowPositions) {
    let Some(path) = positions_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(serialized) = serde_json::to_string_pretty(positions) {
        let _ = fs::write(path, serialized);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Call this once from `setup()`. Loads the saved positions from disk into the
/// in-memory store, then schedules a deferred restore (200 ms) so the webview
/// windows are guaranteed to be fully created before `set_position()` is called.
pub fn restore_widget_positions(app: &AppHandle) {
    // Seed the in-memory store from disk so subsequent saves don't clobber
    // positions for windows that haven't moved yet in this session.
    let positions = load_positions_from_disk(app);
    {
        let store = get_store();
        let mut s = store.lock().unwrap();
        s.positions = positions;
    }

    // Deferred apply: wait 200 ms for all webview windows to finish creating.
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        let store    = get_store();
        let positions = store.lock().unwrap().positions.clone();

        for label in ["pill", "compact", "hud"] {
            let Some(saved) = positions.get(label).copied() else {
                continue;
            };
            let Some(window) = app_handle.get_webview_window(label) else {
                continue;
            };

            // Guard against off-screen positions from a disconnected monitor.
            let (safe_x, safe_y) = clamp_to_screen(&app_handle, label, saved.x, saved.y);

            let _ = window.set_position(Position::Physical(PhysicalPosition {
                x: safe_x,
                y: safe_y,
            }));
        }
    });
}

/// Call this from `.on_window_event` for every `WindowEvent::Moved`.
/// Updates the in-memory map immediately and schedules a debounced disk flush.
/// Only widget windows (pill / compact / hud) are tracked; all others are ignored.
pub fn save_widget_position(app: &AppHandle, label: &str, position: PhysicalPosition<i32>) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }

    let store = get_store();
    {
        let mut s = store.lock().unwrap();
        s.positions.insert(
            label.to_string(),
            StoredWindowPosition { x: position.x, y: position.y },
        );
        s.last_move_at = Some(Instant::now());
        s.needs_flush  = true;
    }

    // Spawn a task that waits for the debounce window to expire, then flushes.
    // If more Moved events arrive they push `last_move_at` forward, causing
    // earlier tasks to bail out without writing — only the last one wins.
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(DEBOUNCE_DURATION).await;

        let store = get_store();
        let (should_flush, positions) = {
            let mut s = store.lock().unwrap();
            if !s.needs_flush {
                return;
            }
            // Only flush if the debounce window has actually expired.
            let elapsed = s.last_move_at
                .map(|t| t.elapsed())
                .unwrap_or(DEBOUNCE_DURATION);
            if elapsed < DEBOUNCE_DURATION {
                return; // a newer task will handle it
            }
            s.needs_flush = false;
            (true, s.positions.clone())
        };

        if should_flush {
            flush_to_disk(&app_handle, &positions);
        }
    });
}

// ── Screen bounds guard ───────────────────────────────────────────────────────

/// Returns `(x, y)` clamped so the widget is not placed entirely off-screen.
/// Falls back to (100, 100) if monitor information is unavailable.
fn clamp_to_screen(app: &AppHandle, label: &str, x: i32, y: i32) -> (i32, i32) {
    // Get the window so we can query available monitors.
    let Some(window) = app.get_webview_window(label) else {
        return (x, y);
    };

    // Try to get the list of monitors; fall back gracefully if unavailable.
    let Ok(monitors) = window.available_monitors() else {
        return (x, y);
    };
    if monitors.is_empty() {
        return (x, y);
    }

    // Check if the position falls within any monitor's work area (with margin).
    for monitor in &monitors {
        let pos  = monitor.position();
        let size = monitor.size();

        let left   = pos.x;
        let top    = pos.y;
        let right  = pos.x + size.width as i32;
        let bottom = pos.y + size.height as i32;

        // The widget is "on" this monitor if its top-left corner is within it.
        if x >= left && x < right && y >= top && y < bottom {
            // It's on a valid monitor — clamp to keep at least SCREEN_MARGIN
            // pixels visible so the user can always grab and move it.
            let clamped_x = x.clamp(left, right  - SCREEN_MARGIN);
            let clamped_y = y.clamp(top,  bottom - SCREEN_MARGIN);
            return (clamped_x, clamped_y);
        }
    }

    // Position is on no known monitor (e.g. second screen was disconnected).
    // Fall back to the top-right area of the primary monitor.
    let primary = &monitors[0];
    let ppos    = primary.position();
    let psize   = primary.size();

    let fallback_x = ppos.x + psize.width  as i32 - 200;
    let fallback_y = ppos.y + 40;

    (fallback_x, fallback_y)
}