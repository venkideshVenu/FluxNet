use crate::dto::ping::PingStats;
use crate::monitor::ping::measure_ping;
use std::net::IpAddr;
use std::sync::Mutex;
use tauri::State;

pub struct PingState {
    /// Rolling window of last 10 results — true = lost
    pub loss_window: Vec<bool>,
    pub last_latency_ms: f64,
}

impl Default for PingState {
    fn default() -> Self {
        Self {
            loss_window: Vec::with_capacity(10),
            last_latency_ms: 0.0,
        }
    }
}

pub type SharedPingState = Mutex<PingState>;

// Default target: Cloudflare 1.1.1.1 — fast, reliable, globally reachable
const PING_TARGET: &str = "1.1.1.1";

#[tauri::command]
pub async fn get_ping_stats(state: State<'_, SharedPingState>) -> Result<PingStats, String> {
    let target: IpAddr = PING_TARGET
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    let result = measure_ping(target).await;

    let mut s = state.lock().map_err(|e| e.to_string())?;

    // Update rolling loss window (max 10 samples)
    s.loss_window.push(result.loss);
    if s.loss_window.len() > 10 {
        s.loss_window.remove(0);
    }

    let loss_count = s.loss_window.iter().filter(|&&lost| lost).count();
    let loss_percent = (loss_count as f64 / s.loss_window.len() as f64) * 100.0;

    if let Some(ms) = result.latency_ms {
        s.last_latency_ms = ms;
    }

    Ok(PingStats {
        latency_ms: if result.loss { -1.0 } else { s.last_latency_ms },
        loss_percent,
    })
}
