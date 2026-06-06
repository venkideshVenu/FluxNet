use crate::commands::network::is_widget_label;
use crate::persistence::persistent_store::PersistentStore;
use crate::persistence::widget_state::{StoredPosition, WidgetState};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, PhysicalPosition};
use tokio::sync::Notify;

const DEBOUNCE_MS: u64 = 500;

pub type WidgetStore = PersistentStore<WidgetState>;

// ── Last-write-wins accumulator (FIX M5) ─────────────────────────────────────

pub struct PositionAccumulator {
    /// Most recent pending position per widget label — overwrites old value.
    pending: Mutex<HashMap<String, PhysicalPosition<i32>>>,
    /// Wakes the debounce task whenever a new position arrives.
    notify: Notify,
}

impl PositionAccumulator {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            pending: Mutex::new(HashMap::new()),
            notify: Notify::new(),
        })
    }

    /// Store `position` for `label`, overwriting any previous pending value.
    pub fn push(&self, label: String, position: PhysicalPosition<i32>) {
        self.pending.lock().insert(label, position);
        self.notify.notify_one();
    }

    /// Drain all pending positions — returns an empty map on the next call.
    fn drain(&self) -> HashMap<String, PhysicalPosition<i32>> {
        std::mem::take(&mut *self.pending.lock())
    }
}

/// Tauri-managed state wrapping the accumulator.
pub struct PositionSender(pub Arc<PositionAccumulator>);

// ── Spawn debounced writer ────────────────────────────────────────────────────

pub fn spawn_position_writer(app: AppHandle, store: Arc<WidgetStore>) -> PositionSender {
    let acc = PositionAccumulator::new();
    let acc_clone = acc.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            // Wait for at least one position update
            acc_clone.notify.notified().await;

            // Debounce: keep consuming notifications until the window is quiet
            let deadline = tokio::time::Instant::now() + Duration::from_millis(DEBOUNCE_MS);
            loop {
                match tokio::time::timeout_at(deadline, acc_clone.notify.notified()).await {
                    Ok(()) => {}     // more updates arrived — extend debounce
                    Err(_) => break, // deadline elapsed — flush now
                }
            }

            // Drain and persist — last-write-wins, no positions ever dropped
            let snapshot = acc_clone.drain();
            if snapshot.is_empty() {
                continue;
            }
            store.update(&app, |state| {
                for (label, pos) in &snapshot {
                    state
                        .positions
                        .insert(label.clone(), StoredPosition { x: pos.x, y: pos.y });
                }
            });
        }
    });

    PositionSender(acc)
}

// ── Public enqueue helper ─────────────────────────────────────────────────────

/// Enqueue a position update.  Overwrites any previous pending update for the
/// same label — positions are idempotent, only the latest matters.
pub fn enqueue_position(sender: &PositionSender, label: &str, position: PhysicalPosition<i32>) {
    if !is_widget_label(label) {
        return;
    }
    sender.0.push(label.to_string(), position);
}
