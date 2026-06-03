use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, PhysicalPosition, Position};

use crate::persistence::persistent_store::PersistentStore;

use crate::window_visibility::apply_widget_visibility;

const WINDOW_POSITIONS_FILE: &str = "widget-positions.json";
const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);
const SCREEN_MARGIN: i32 = 50;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
struct StoredWindowPosition {
    x: i32,
    y: i32,
}

type WindowPositions = BTreeMap<String, StoredWindowPosition>;

struct PositionStore {
    positions: WindowPositions,
    last_move_at: Option<Instant>, // when the last Moved event arrived
    needs_flush: bool,             // true if the in-memory map is ahead of disk
}

impl PositionStore {
    fn new() -> Self {
        Self {
            positions: WindowPositions::new(),
            last_move_at: None,
            needs_flush: false,
        }
    }
}

static STORE: std::sync::OnceLock<Arc<Mutex<PositionStore>>> = std::sync::OnceLock::new();
static DISK_STORE: PersistentStore<WindowPositions> = PersistentStore::new(WINDOW_POSITIONS_FILE);

fn get_store() -> Arc<Mutex<PositionStore>> {
    STORE
        .get_or_init(|| Arc::new(Mutex::new(PositionStore::new())))
        .clone()
}

pub fn restore_widget_positions(app: &AppHandle) {
    DISK_STORE.load(app);

    let positions = DISK_STORE.read(|p| p.clone());
    {
        let store = get_store();
        let mut s = store.lock().unwrap();
        s.positions = positions;
    }

    // Deferred apply: wait 200 ms for all webview windows to finish creating.
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;

        let store = get_store();
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

        // Apply visibility after positioning so widgets appear in the right place.
        apply_widget_visibility(&app_handle);
    });
}

pub fn save_widget_position(app: &AppHandle, label: &str, position: PhysicalPosition<i32>) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }

    let store = get_store();
    {
        let mut s = store.lock().unwrap();
        s.positions.insert(
            label.to_string(),
            StoredWindowPosition {
                x: position.x,
                y: position.y,
            },
        );
        s.last_move_at = Some(Instant::now());
        s.needs_flush = true;
    }

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
            let elapsed = s
                .last_move_at
                .map(|t| t.elapsed())
                .unwrap_or(DEBOUNCE_DURATION);
            if elapsed < DEBOUNCE_DURATION {
                return; // a newer task will handle it
            }
            s.needs_flush = false;
            (true, s.positions.clone())
        };

        if should_flush {
            DISK_STORE.update(&app_handle, |saved| {
                *saved = positions;
            });
        }
    });
}

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
        let pos = monitor.position();
        let size = monitor.size();

        let left = pos.x;
        let top = pos.y;
        let right = pos.x + size.width as i32;
        let bottom = pos.y + size.height as i32;

        // The widget is "on" this monitor if its top-left corner is within it.
        if x >= left && x < right && y >= top && y < bottom {
            // It's on a valid monitor — clamp to keep at least SCREEN_MARGIN
            // pixels visible so the user can always grab and move it.
            let clamped_x = x.clamp(left, right - SCREEN_MARGIN);
            let clamped_y = y.clamp(top, bottom - SCREEN_MARGIN);
            return (clamped_x, clamped_y);
        }
    }

    // Position is on no known monitor (e.g. second screen was disconnected).
    // Fall back to the top-right area of the primary monitor.
    let primary = &monitors[0];
    let ppos = primary.position();
    let psize = primary.size();

    let fallback_x = ppos.x + psize.width as i32 - 200;
    let fallback_y = ppos.y + 40;

    (fallback_x, fallback_y)
}
