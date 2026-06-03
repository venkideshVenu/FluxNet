use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct PingStats {
    pub latency_ms: f64,
    pub loss_percent: f64,
}
