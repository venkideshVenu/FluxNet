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

pub struct PositionAccumulator {
    pending: Mutex<HashMap<String, PhysicalPosition<i32>>>,
    notify: Notify,
}

impl PositionAccumulator {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            pending: Mutex::new(HashMap::new()),
            notify: Notify::new(),
        })
    }

    pub fn push(&self, label: String, position: PhysicalPosition<i32>) {
        self.pending.lock().insert(label, position);
        self.notify.notify_one();
    }

    fn drain(&self) -> HashMap<String, PhysicalPosition<i32>> {
        std::mem::take(&mut *self.pending.lock())
    }
}

pub struct PositionSender(pub Arc<PositionAccumulator>);

pub fn spawn_position_writer(app: AppHandle, store: Arc<WidgetStore>) -> PositionSender {
    let acc = PositionAccumulator::new();
    let acc_clone = acc.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            acc_clone.notify.notified().await;

            // Debounce
            let deadline = tokio::time::Instant::now() + Duration::from_millis(DEBOUNCE_MS);
            while tokio::time::timeout_at(deadline, acc_clone.notify.notified())
                .await
                .is_ok()
            {}

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

            tracing::debug!("Flushed {} widget position(s) to disk", snapshot.len());
        }
    });

    PositionSender(acc)
}

pub fn enqueue_position(sender: &PositionSender, label: &str, position: PhysicalPosition<i32>) {
    if !is_widget_label(label) {
        return;
    }
    sender.0.push(label.to_string(), position);
}
