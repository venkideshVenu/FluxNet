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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_state_reports_zero() {
        let s = PingState::default().current_stats();
        assert_eq!(s.loss_percent, 0.0);
        assert_eq!(s.latency_ms, 0.0);
    }

    #[test]
    fn loss_percent_uses_rolling_window() {
        let mut s = PingState::default();
        for i in 0..20 {
            s.update(Some(10.0), i % 5 == 0 && i >= 10);
        }
        // Last 10 results: i = 10..20, losses at 10 and 15.
        assert_eq!(s.current_stats().loss_percent, 20.0);
        assert_eq!(s.loss_window.len(), WINDOW);
    }

    #[test]
    fn three_consecutive_losses_mark_latency_unknown() {
        let mut s = PingState::default();
        s.update(Some(25.0), false);
        s.update(None, true);
        s.update(None, true);
        assert_eq!(s.current_stats().latency_ms, 25.0);
        s.update(None, true);
        assert_eq!(s.current_stats().latency_ms, -1.0);
        s.update(Some(30.0), false);
        assert_eq!(s.current_stats().latency_ms, 30.0);
    }
}
