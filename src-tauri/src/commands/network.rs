use crate::monitor::bandwidth::{
    calculate_speed, list_interfaces, read_total_counters, NetworkStats,
};
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::Networks;
use tauri::State;

pub struct MonitorState {
    pub prev_tx: u64,
    pub prev_rx: u64,
    pub last_sample: Option<Instant>,
    pub interface: String,
    pub networks: Networks, // ← lives here, persists between polls
}

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            prev_tx: 0,
            prev_rx: 0,
            last_sample: None,
            interface: String::new(),
            networks: Networks::new_with_refreshed_list(), // initial snapshot
        }
    }
}

pub type SharedMonitorState = Mutex<MonitorState>;

#[tauri::command]
pub fn get_network_stats(state: State<SharedMonitorState>) -> NetworkStats {
    let mut s = state.lock().unwrap();

    // Refresh the SAME object — this updates total_transmitted/total_received
    s.networks.refresh();

    if s.interface.is_empty() {
        let ifaces = list_interfaces(&s.networks);
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

    match read_total_counters(&s.networks, &s.interface) {
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

#[tauri::command]
pub fn get_interfaces(state: State<SharedMonitorState>) -> Vec<String> {
    let s = state.lock().unwrap();
    list_interfaces(&s.networks)
}

#[tauri::command]
pub fn set_interface(name: String, state: State<SharedMonitorState>) {
    let mut s = state.lock().unwrap();
    s.interface = name;
    s.prev_tx = 0;
    s.prev_rx = 0;
    s.last_sample = None;
    // Note: don't reset networks — keep the running object
}
