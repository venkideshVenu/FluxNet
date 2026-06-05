use crate::persistence::persistent_store::PersistentStore;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use tauri::{AppHandle, PhysicalPosition};
use tokio::sync::mpsc;

const DEBOUNCE_MS: u64 = 500;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct StoredPosition {
    pub x: i32,
    pub y: i32,
}

pub type PositionMap = BTreeMap<String, StoredPosition>;
pub type PositionStore = PersistentStore<PositionMap>;

pub struct PositionSender(pub mpsc::Sender<(String, PhysicalPosition<i32>)>);

/// Spawn the debounced position writer. The store is owned and managed by Tauri state.
pub fn spawn_position_writer(app: AppHandle, store: Arc<PositionStore>) -> PositionSender {
    let (tx, mut rx) = mpsc::channel::<(String, PhysicalPosition<i32>)>(64);
    store.load(&app);
    tauri::async_runtime::spawn(async move {
        let mut pending: HashMap<String, PhysicalPosition<i32>> = HashMap::new();
        loop {
            let Some((label, pos)) = rx.recv().await else { break };
            pending.insert(label, pos);
            let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_millis(DEBOUNCE_MS);
            loop {
                match tokio::time::timeout_at(deadline, rx.recv()).await {
                    Ok(Some((l, p))) => pending.insert(l, p),
                    _ => break,
                };
            }
            store.update(&app, |map| {
                for (label, pos) in &pending {
                    map.insert(label.clone(), StoredPosition { x: pos.x, y: pos.y });
                }
            });
            pending.clear();
        }
    });
    PositionSender(tx)
}

/// Send a position update to the debouncer.
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