use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Manager};

const WINDOW_VISIBILITY_FILE: &str = "widget-visibility.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
struct StoredWindowVisibility {
    visible: bool,
}

type WindowVisibility = BTreeMap<String, StoredWindowVisibility>;

// ── Shared in-memory state ────────────────────────────────────────────────────
//
// Mirrors the same pattern as window_positions.rs:
//  - Load from disk once at startup into the OnceLock.
//  - All subsequent reads come from memory — no disk read on every save.
//  - Writes update memory first, then flush to disk immediately
//    (visibility changes are deliberate user actions, low-frequency,
//     so no debounce is needed — but we still avoid the load-modify-save
//     pattern that could race if two windows change at the same time).

static STORE: std::sync::OnceLock<Arc<Mutex<WindowVisibility>>> = std::sync::OnceLock::new();

fn get_store() -> Arc<Mutex<WindowVisibility>> {
    STORE
        .get_or_init(|| Arc::new(Mutex::new(WindowVisibility::new())))
        .clone()
}

// ── File I/O helpers ──────────────────────────────────────────────────────────

fn visibility_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_VISIBILITY_FILE))
}

fn load_from_disk(app: &AppHandle) -> WindowVisibility {
    let Some(path) = visibility_path(app) else {
        return WindowVisibility::new();
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return WindowVisibility::new();
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

fn flush_to_disk(app: &AppHandle, visibility: &WindowVisibility) {
    let Some(path) = visibility_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(serialized) = serde_json::to_string_pretty(visibility) {
        let _ = fs::write(path, serialized);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Call this once from `setup()` — before `restore_widget_positions` —
/// to seed the in-memory store from disk.
///
/// The actual show/hide is applied inside `restore_widget_positions`'s
/// deferred task (T+200 ms) so both position and visibility land together
/// and windows are guaranteed to be fully created.
pub fn load_widget_visibility(app: &AppHandle) {
    let visibility = load_from_disk(app);
    let store = get_store();
    let mut s = store.lock().unwrap();
    *s = visibility;
}

/// Apply the saved visibility state to all widget windows.
///
/// Called from the same deferred task as position restoration, AFTER
/// set_position() so windows appear at the right place before being shown.
///
/// Key behaviour differences from the original:
///  - Missing entry → leave the window untouched (first-launch safe).
///  - Never calls set_focus() — restoring a saved state must not steal focus.
pub fn apply_widget_visibility(app: &AppHandle) {
    let store = get_store();
    let visibility = store.lock().unwrap().clone();

    for label in ["pill", "compact", "hud"] {
        // No saved entry means this is a first launch or the entry was removed.
        // Leave the window in whatever state tauri.conf.json defined — don't hide it.
        let Some(saved) = visibility.get(label).copied() else {
            continue;
        };

        if let Some(window) = app.get_webview_window(label) {
            if saved.visible {
                let _ = window.show();
                // Intentionally NOT calling set_focus() here.
                // The widget should restore silently without stealing focus
                // from whatever the user was doing when the app auto-started.
            } else {
                let _ = window.hide();
            }
        }
    }
}

/// Save the new visibility state for `label` to memory and immediately flush to disk.
///
/// Call this from every code path that shows or hides a widget:
///  - Tray menu events (main.rs)
///  - The `set_widget_visibility` Tauri command (commands/visibility.rs)
pub fn save_widget_visibility(app: &AppHandle, label: &str, visible: bool) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }

    // Update memory first, then flush — no disk read required.
    let store = get_store();
    {
        let mut s = store.lock().unwrap();
        s.insert(label.to_string(), StoredWindowVisibility { visible });
    }

    // Read the current snapshot for flushing (avoids holding the lock during I/O).
    let snapshot = store.lock().unwrap().clone();
    flush_to_disk(app, &snapshot);
}