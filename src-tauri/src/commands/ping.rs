use crate::dto::ping::PingStats;
use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

pub type SharedPingState = Arc<Mutex<PingState>>;

/// Rolling window size for packet-loss percentage.
const WINDOW: usize = 10;
/// Number of consecutive lost packets before latency is reported as -1.0.
const N_CONSECUTIVE_LOSS: usize = 3;

pub struct PingState {
    /// Rolling window of last WINDOW results — true = lost packet.
    pub loss_window: VecDeque<bool>,
    /// Most recent successfully measured latency.
    pub last_latency_ms: f64,
}

impl Default for PingState {
    fn default() -> Self {
        Self {
            loss_window: VecDeque::with_capacity(WINDOW),
            last_latency_ms: 0.0,
        }
    }
}

impl PingState {
    pub fn update(&mut self, latency_ms: Option<f64>, loss: bool) {
        self.loss_window.push_back(loss);
        if self.loss_window.len() > WINDOW {
            self.loss_window.pop_front();
        }
        if let Some(ms) = latency_ms {
            self.last_latency_ms = ms;
        }
    }

    pub fn current_stats(&self) -> PingStats {
        let total = self.loss_window.len();
        let loss_count = self.loss_window.iter().filter(|&&lost| lost).count();
        let loss_percent = if total == 0 {
            0.0
        } else {
            (loss_count as f64 / total as f64) * 100.0
        };

        let consecutive_losses = self
            .loss_window
            .iter()
            .rev()
            .take(N_CONSECUTIVE_LOSS)
            .filter(|&&lost| lost)
            .count();

        let latency_ms = if consecutive_losses >= N_CONSECUTIVE_LOSS {
            -1.0
        } else {
            self.last_latency_ms
        };

        PingStats {
            latency_ms,
            loss_percent,
        }
    }
}

#[tauri::command]
pub fn get_ping_stats(app: AppHandle) -> Result<PingStats, String> {
    let state = app
        .try_state::<SharedPingState>()
        .ok_or_else(|| "Ping state not yet initialized".to_string())?;
    let s = state.lock();
    Ok(s.current_stats())
}
