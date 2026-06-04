use crate::dto::ping::PingStats;
use parking_lot::Mutex;
use std::sync::Arc;

pub type SharedPingState = Arc<Mutex<PingState>>;

#[derive(Default)]
pub struct PingState {
    /// Rolling window of last 10 results – true = lost
    pub loss_window: Vec<bool>,
    pub last_latency_ms: f64,
}

impl PingState {
    pub fn update(&mut self, latency_ms: Option<f64>, loss: bool) {
        self.loss_window.push(loss);
        if self.loss_window.len() > 10 {
            self.loss_window.remove(0);
        }
        if let Some(ms) = latency_ms {
            self.last_latency_ms = ms;
        }
    }

    pub fn current_stats(&self) -> PingStats {
        let loss_count = self.loss_window.iter().filter(|&&lost| lost).count();
        let loss_percent = if self.loss_window.is_empty() {
            0.0
        } else {
            (loss_count as f64 / self.loss_window.len() as f64) * 100.0
        };
        PingStats {
            latency_ms: if loss_count > 0 && self.loss_window.last() == Some(&true) {
                -1.0
            } else {
                self.last_latency_ms
            },
            loss_percent,
        }
    }
}

#[tauri::command]
pub fn get_ping_stats(state: tauri::State<SharedPingState>) -> Result<PingStats, String> {
    let s = state.lock();
    Ok(s.current_stats())
}
