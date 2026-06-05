use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use tauri::{AppHandle, PhysicalPosition};
use tokio::sync::mpsc;

const DEBOUNCE_MS: u64 = 500;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct StoredPosition {
    pub x: i32,
    pub y: i32,
}
pub type PositionMap = BTreeMap<String, StoredPosition>;
pub static STORE: PersistentStore<PositionMap> = PersistentStore::new("widget-positions.json");

pub struct PositionSender(pub mpsc::Sender<(String, PhysicalPosition<i32>)>);

pub fn spawn_position_writer(app: AppHandle) -> PositionSender {
    let (tx, mut rx) = mpsc::channel::<(String, PhysicalPosition<i32>)>(64);
    STORE.load(&app);
    tauri::async_runtime::spawn(async move {
        let mut pending: HashMap<String, PhysicalPosition<i32>> = HashMap::new();
        loop {
            let Some((label, pos)) = rx.recv().await else {
                break;
            };
            pending.insert(label, pos);
            let deadline =
                tokio::time::Instant::now() + tokio::time::Duration::from_millis(DEBOUNCE_MS);
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