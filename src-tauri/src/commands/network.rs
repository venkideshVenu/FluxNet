use crate::monitor::bandwidth::{
    calculate_speed, list_interfaces, read_interface_counters, NetworkStats,
};
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

/// Shared state that persists between command calls.
/// Stores the previous byte counters and timestamp for delta calculation.
pub struct MonitorState {
    pub prev_tx: u64,
    pub prev_rx: u64,
    pub last_sample: Option<Instant>,
    pub interface: String,
}

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            prev_tx: 0,
            prev_rx: 0,
            last_sample: None,
            interface: String::new(),
        }
    }
}

pub type SharedMonitorState = Mutex<MonitorState>;

/// Called by the frontend every second to get current network speeds.
#[tauri::command]
pub fn get_network_stats(state: State<SharedMonitorState>) -> NetworkStats {
    let mut s = state.lock().unwrap();

    if s.interface.is_empty() {
        // Auto-select the first non-loopback interface
        let ifaces = list_interfaces();
        s.interface = ifaces
            .into_iter()
            .find(|n| n != "lo" && n != "Loopback Pseudo-Interface 1")
            .unwrap_or_default();
    }

    let now = Instant::now();
    let elapsed = match s.last_sample {
        Some(prev) => now.duration_since(prev).as_secs_f64(),
        None => 1.0,
    };

    match read_interface_counters(&s.interface) {
        Some((tx, rx)) => {
            let upload = calculate_speed(tx, s.prev_tx, elapsed);
            let download = calculate_speed(rx, s.prev_rx, elapsed);

            s.prev_tx = tx;
            s.prev_rx = rx;
            s.last_sample = Some(now);

            NetworkStats {
                upload_bytes_per_sec: upload,
                download_bytes_per_sec: download,
                interface_name: s.interface.clone(),
            }
        }
        None => NetworkStats {
            upload_bytes_per_sec: 0.0,
            download_bytes_per_sec: 0.0,
            interface_name: s.interface.clone(),
        },
    }
}

/// Returns a list of all interface names for future settings UI.
#[tauri::command]
pub fn get_interfaces() -> Vec<String> {
    list_interfaces()
}

/// Lets the frontend change which interface to monitor.
#[tauri::command]
pub fn set_interface(name: String, state: State<SharedMonitorState>) {
    let mut s = state.lock().unwrap();
    s.interface = name;
    s.prev_tx = 0;
    s.prev_rx = 0;
    s.last_sample = None;
}