use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
};
use tauri::{AppHandle, Manager};

const WINDOW_VISIBILITY_FILE: &str = "widget-visibility.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
struct StoredWindowVisibility {
    visible: bool,
}

type WindowVisibility = BTreeMap<String, StoredWindowVisibility>;

static STORE: PersistentStore<WindowVisibility> = PersistentStore::new(WINDOW_VISIBILITY_FILE);

pub fn load_widget_visibility(app: &AppHandle) {
    STORE.load(app);
}

pub fn apply_widget_visibility(app: &AppHandle) {
    let visibility = STORE.read(|v| v.clone());

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

pub fn save_widget_visibility(
    app: &AppHandle,
    label: &str,
    visible: bool,
) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }

    STORE.update(app, |visibility| {
        visibility.insert(
            label.to_string(),
            StoredWindowVisibility { visible },
        );
    });
}