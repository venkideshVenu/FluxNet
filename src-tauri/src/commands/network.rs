use crate::monitor::bandwidth::{
    calculate_speed, list_interfaces, read_total_counters, NetworkStats,
};
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::Networks;
use tauri::{AppHandle, Manager, State};

pub struct HistoryPoint {
    pub upload: f64,
    pub download: f64,
    pub timestamp_secs: u64,
}

pub struct MonitorState {
    pub prev_tx: u64,
    pub prev_rx: u64,
    pub last_sample: Option<Instant>,
    pub interface: String,
    pub networks: Networks,
    pub peak_upload: f64,
    pub peak_download: f64,
    pub history: Vec<HistoryPoint>, // ring buffer, max 120 points
    pub start_time: Instant,
}

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            prev_tx: 0,
            prev_rx: 0,
            last_sample: None,
            interface: String::new(),
            networks: Networks::new_with_refreshed_list(),
            peak_upload: 0.0,
            peak_download: 0.0,
            history: Vec::with_capacity(120),
            start_time: Instant::now(),
        }
    }
}

pub type SharedMonitorState = Mutex<MonitorState>;

// ── Existing commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_network_stats(state: State<SharedMonitorState>) -> NetworkStats {
    let mut s = state.lock().unwrap();
    s.networks.refresh();

    if s.interface.is_empty() {
        let ifaces = list_interfaces(&s.networks);
        s.interface = ifaces
            .into_iter()
            .find(|n| n != "lo" && n != "Loopback Pseudo-Interface 1")
            .unwrap_or_default();
    }

    let now = Instant::now();

    match read_total_counters(&s.networks, &s.interface) {
        Some((tx, rx)) => {
            if s.last_sample.is_none() {
                // Prime counters on first sample to avoid a huge initial spike.
                s.prev_tx = tx;
                s.prev_rx = rx;
                s.last_sample = Some(now);
                return NetworkStats {
                    upload_bytes_per_sec: 0.0,
                    download_bytes_per_sec: 0.0,
                    interface_name: s.interface.clone(),
                };
            }

            let elapsed = now.duration_since(s.last_sample.unwrap()).as_secs_f64();
            let upload = calculate_speed(tx, s.prev_tx, elapsed);
            let download = calculate_speed(rx, s.prev_rx, elapsed);

            if upload > s.peak_upload {
                s.peak_upload = upload;
            }
            if download > s.peak_download {
                s.peak_download = download;
            }

            let ts = now.duration_since(s.start_time).as_secs();
            if s.history.len() >= 120 {
                s.history.remove(0);
            }
            s.history.push(HistoryPoint {
                upload,
                download,
                timestamp_secs: ts,
            });

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

#[derive(serde::Serialize)]
pub struct DashboardSnapshot {
    pub current_upload: f64,
    pub current_download: f64,
    pub peak_upload: f64,
    pub peak_download: f64,
    pub interface_name: String,
    pub history: Vec<HistorySnapshotPoint>,
}

#[derive(serde::Serialize)]
pub struct HistorySnapshotPoint {
    pub upload: f64,
    pub download: f64,
    pub t: u64,
}

#[tauri::command]
pub fn get_dashboard_snapshot(state: State<SharedMonitorState>) -> DashboardSnapshot {
    let s = state.lock().unwrap();
    DashboardSnapshot {
        current_upload: s.history.last().map(|p| p.upload).unwrap_or(0.0),
        current_download: s.history.last().map(|p| p.download).unwrap_or(0.0),
        peak_upload: s.peak_upload,
        peak_download: s.peak_download,
        interface_name: s.interface.clone(),
        history: s
            .history
            .iter()
            .map(|p| HistorySnapshotPoint {
                upload: p.upload,
                download: p.download,
                t: p.timestamp_secs,
            })
            .collect(),
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
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
    s.history.clear();
}

#[tauri::command]
pub fn reset_peaks(state: State<SharedMonitorState>) {
    let mut s = state.lock().unwrap();
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
}

// ── New settings commands ────────────────────────────────────────────────────

/// Set the pill window's always-on-top state.
#[tauri::command]
pub fn set_pill_always_on_top(value: bool, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pill")
        .ok_or_else(|| "pill window not found".to_string())?;
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

/// Set the pill window's opacity (0.0 – 1.0).
#[tauri::command]
pub fn set_pill_opacity(value: f64, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pill")
        .ok_or_else(|| "pill window not found".to_string())?;
    // clamp to [0.1, 1.0] so the window is never invisible
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity = '{0}'; document.body.style.opacity = '{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}
