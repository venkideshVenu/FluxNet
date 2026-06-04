use crate::persistence::persistent_store::PersistentStore;
use crate::window_visibility::apply_widget_visibility;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use tauri::{AppHandle, Manager, PhysicalPosition, Position};
use tokio::sync::mpsc;

const DEBOUNCE_MS: u64 = 500;
const SCREEN_MARGIN: i32 = 20;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct StoredPosition {
    pub x: i32,
    pub y: i32,
}
pub type PositionMap = BTreeMap<String, StoredPosition>;
static STORE: PersistentStore<PositionMap> = PersistentStore::new("widget-positions.json");

pub struct PositionSender(pub mpsc::Sender<(String, PhysicalPosition<i32>)>);

pub fn spawn_position_writer(app: AppHandle) -> PositionSender {
    let (tx, mut rx) = mpsc::channel::<(String, PhysicalPosition<i32>)>(64);
    STORE.load(&app);
    tauri::async_runtime::spawn(async move {
        let mut pending: HashMap<String, PhysicalPosition<i32>> = HashMap::new();
        loop {
            let Some((label, pos)) = rx.recv().await else { break };
            pending.insert(label, pos);
            let deadline = tokio::time::Instant::now()
                + tokio::time::Duration::from_millis(DEBOUNCE_MS);
            loop {
                match tokio::time::timeout_at(deadline, rx.recv()).await {
                    Ok(Some((l, p))) => pending.insert(l, p),
                    _ => break,
                };
            }
            STORE.update(&app, |map| {
                for (label, pos) in &pending {
                    map.insert(label.clone(), StoredPosition { x: pos.x, y: pos.y });
                }
            });
            pending.clear();
        }
    });
    PositionSender(tx)
}

pub fn enqueue_position(
    sender: &mpsc::Sender<(String, PhysicalPosition<i32>)>,
    label: &str,
    position: PhysicalPosition<i32>,
) {
    if !matches!(label, "pill" | "compact" | "hud") {
        return;
    }
    let _ = sender.try_send((label.to_string(), position));
}

pub fn restore_widget_positions(app: &AppHandle) {
    let positions = STORE.read(|m| m.clone());
    for label in ["pill", "compact", "hud"] {
        let Some(window) = app.get_webview_window(label) else { continue };
        let saved = positions.get(label).copied();

        // Restore position immediately (no event needed)
        if let Some(pos) = saved {
            let (safe_x, safe_y) = clamp_to_screen(&window, pos.x, pos.y);
            let _ = window.set_position(Position::Physical(PhysicalPosition {
                x: safe_x,
                y: safe_y,
            }));
        }
    }
    // Apply visibility after all positions are restored
    apply_widget_visibility(app);
}

fn clamp_to_screen(window: &tauri::WebviewWindow, x: i32, y: i32) -> (i32, i32) {
    let outer = window.outer_size().unwrap_or(tauri::PhysicalSize {
        width: 270,
        height: 54,
    });
    let widget_w = outer.width as i32;
    let widget_h = outer.height as i32;
    let monitors = match window.available_monitors() {
        Ok(m) if !m.is_empty() => m,
        _ => return (x, y),
    };
    for monitor in &monitors {
        let pos = monitor.position();
        let size = monitor.size();
        let left = pos.x;
        let top = pos.y;
        let right = pos.x + size.width as i32;
        let bottom = pos.y + size.height as i32;
        if x >= left && x < right && y >= top && y < bottom {
            let min_x = left + SCREEN_MARGIN;
            let max_x = right - widget_w - SCREEN_MARGIN;
            let min_y = top + SCREEN_MARGIN;
            let max_y = bottom - widget_h - SCREEN_MARGIN;
            let clamped_x = if max_x < min_x {
                x.clamp(left, right - widget_w)
            } else {
                x.clamp(min_x, max_x)
            };
            let clamped_y = if max_y < min_y {
                y.clamp(top, bottom - widget_h)
            } else {
                y.clamp(min_y, max_y)
            };
            return (clamped_x, clamped_y);
        }
    }
    let primary = &monitors[0];
    let ppos = primary.position();
    let psize = primary.size();
    let fallback_x = (ppos.x + psize.width as i32 - widget_w - 40).max(ppos.x);
    let fallback_y = ppos.y + 40;
    (fallback_x, fallback_y)
}