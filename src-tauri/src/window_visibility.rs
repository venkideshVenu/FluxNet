use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const WINDOW_VISIBILITY_FILE: &str = "widget-visibility.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
struct StoredWindowVisibility {
    visible: bool,
}

type WindowVisibility = BTreeMap<String, StoredWindowVisibility>;

fn visibility_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(WINDOW_VISIBILITY_FILE))
}

fn load_visibility(app: &AppHandle) -> WindowVisibility {
    let Some(path) = visibility_path(app) else {
        return WindowVisibility::new();
    };

    let Ok(contents) = fs::read_to_string(path) else {
        return WindowVisibility::new();
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_visibility(app: &AppHandle, visibility: &WindowVisibility) {
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

pub fn restore_widget_visibility(app: &AppHandle) {
    let visibility = load_visibility(app);

    for label in ["pill", "compact", "hud"] {
        let visible = visibility.get(label).copied().unwrap_or_default().visible;

        if let Some(window) = app.get_webview_window(label) {
            let result = if visible {
                window.show()
            } else {
                window.hide()
            };
            let _ = result;
            if visible {
                let _ = window.set_focus();
            }
        }
    }
}

pub fn save_widget_visibility(app: &AppHandle, label: &str, visible: bool) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }

    let mut visibility = load_visibility(app);
    visibility.insert(label.to_string(), StoredWindowVisibility { visible });
    save_visibility(app, &visibility);
}
