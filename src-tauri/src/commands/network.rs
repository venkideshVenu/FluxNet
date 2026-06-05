use crate::commands::ping::{PingState, SharedPingState};
use crate::dto::network::{DashboardSnapshot, HistorySnapshotPoint, InterfaceInfo};
use crate::monitor::bandwidth::{
    calculate_speed, list_interfaces, read_total_counters, NetworkStats,
};
use parking_lot::Mutex;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::Networks;
use tauri::{AppHandle, Manager, State};
use windows::core::PWSTR;
use windows::Win32::Foundation::{ERROR_BUFFER_OVERFLOW, NO_ERROR};
use windows::Win32::NetworkManagement::IpHelper::{
    GetAdaptersAddresses, GAA_FLAG_INCLUDE_ALL_INTERFACES, IF_TYPE_ETHERNET_CSMACD,
    IF_TYPE_IEEE80211, IF_TYPE_SOFTWARE_LOOPBACK, IP_ADAPTER_ADDRESSES_LH,
};
use windows::Win32::NetworkManagement::Ndis::IF_OPER_STATUS;
use windows::Win32::Networking::WinSock::AF_UNSPEC;

pub type SharedMonitorState = Arc<Mutex<MonitorState>>;

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
    pub interfaces_cache: Vec<InterfaceInfo>,
    pub interfaces_cache_at: Option<Instant>,

    // ── Cached result of the last background tick ─────────────────────────
    // All Tauri commands read from here; only the background task writes here.
    pub last_upload: f64,
    pub last_download: f64,
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
            interfaces_cache: Vec::new(),
            interfaces_cache_at: None,
            last_upload: 0.0,
            last_download: 0.0,
        }
    }
}

// ── Single background sampler ─────────────────────────────────────────────────
//
// Called once every 500 ms from a dedicated tokio task spawned in main().
// Every Tauri command is now a cheap read from the cached values — no
// sampling happens inside any command handler, so multiple windows can
// call commands concurrently without interfering with each other.

pub fn tick_sample(s: &mut MonitorState) {
    s.networks.refresh();

    // Auto-select interface on first run or if it got cleared.
    if s.interface.is_empty() {
        let mut best_name = String::new();
        let mut best_bytes = 0u64;

        for (name, data) in &s.networks {
            if name == "lo" || name == "Loopback Pseudo-Interface 1" {
                continue;
            }
            let total = data.total_received() + data.total_transmitted();
            if total > best_bytes {
                best_bytes = total;
                best_name = name.clone();
            }
        }

        if best_name.is_empty() {
            let ifaces = list_interfaces(&s.networks);
            best_name = ifaces
                .into_iter()
                .find(|n| n != "lo" && n != "Loopback Pseudo-Interface 1")
                .unwrap_or_default();
        }

        s.interface = best_name;
    }

    let now = Instant::now();

    if let Some((tx, rx)) = read_total_counters(&s.networks, &s.interface) {
        if s.last_sample.is_none() {
            // Prime on first tick — no speed yet.
            s.prev_tx = tx;
            s.prev_rx = rx;
            s.last_sample = Some(now);
            return;
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

        // ── Write the cache ────────────────────────────────────────────────
        s.last_upload = upload;
        s.last_download = download;
    }
}

// ── Tauri commands — all read-only, never sample ─────────────────────────────

/// Lightweight: returns only current up/down speeds.
/// Used by Pill and HUD windows.
#[tauri::command]
pub fn get_network_stats(state: tauri::State<SharedMonitorState>) -> NetworkStats {
    let s = state.lock();
    NetworkStats {
        upload_bytes_per_sec: s.last_upload,
        download_bytes_per_sec: s.last_download,
        interface_name: s.interface.clone(),
    }
}

/// Full snapshot: speeds + peaks + history.
/// Used by Compact and Dashboard windows.
#[tauri::command]
pub fn get_dashboard_snapshot(state: State<SharedMonitorState>) -> DashboardSnapshot {
    let s = state.lock();
    DashboardSnapshot {
        current_upload: s.last_upload,
        current_download: s.last_download,
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
pub fn get_interfaces(state: State<SharedMonitorState>) -> Vec<InterfaceInfo> {
    // First check (read lock) – fast path
    {
        let s = state.lock();
        if let Some(at) = s.interfaces_cache_at {
            if at.elapsed() < Duration::from_secs(10) {
                return s.interfaces_cache.clone();
            }
        }
    }

    // Cache miss or expired – do the expensive Win32 call
    let interfaces = read_interfaces_from_windows();

    // Second check (write lock) – prevent duplicate work
    let mut s = state.lock();
    if let Some(at) = s.interfaces_cache_at {
        if at.elapsed() < Duration::from_secs(10) {
            // Another thread already refreshed the cache while we were doing the call
            return s.interfaces_cache.clone();
        }
    }
    // Still stale – update cache
    s.interfaces_cache = interfaces.clone();
    s.interfaces_cache_at = Some(Instant::now());
    interfaces
}

fn read_interfaces_from_windows() -> Vec<InterfaceInfo> {
    let mut interfaces = Vec::new();

    let mut buf_len: u32 = 0;
    let mut ret = unsafe {
        GetAdaptersAddresses(
            AF_UNSPEC.0 as u32,
            GAA_FLAG_INCLUDE_ALL_INTERFACES,
            None,
            None,
            &mut buf_len,
        )
    };

    if ret != ERROR_BUFFER_OVERFLOW.0 && ret != NO_ERROR.0 {
        return interfaces;
    }

    if buf_len == 0 {
        return interfaces;
    }

    let mut buffer = vec![0u8; buf_len as usize];
    let adapter_ptr = buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH;

    ret = unsafe {
        GetAdaptersAddresses(
            AF_UNSPEC.0 as u32,
            GAA_FLAG_INCLUDE_ALL_INTERFACES,
            None,
            Some(adapter_ptr),
            &mut buf_len,
        )
    };

    if ret != NO_ERROR.0 {
        return interfaces;
    }

    let mut current = adapter_ptr;
    while !current.is_null() {
        let adapter = unsafe { &*current };

        if adapter.IfType == IF_TYPE_SOFTWARE_LOOPBACK {
            current = adapter.Next;
            continue;
        }

        let name = pwstr_to_string(adapter.FriendlyName);
        if name.is_empty() {
            current = adapter.Next;
            continue;
        }

        let description = pwstr_to_string(adapter.Description);
        let name_lower = name.to_lowercase();
        let desc_lower = description.to_lowercase();
        if name_lower.contains("local area connection*")
            || name_lower.contains("wi-fi direct")
            || name_lower.contains("wifi direct")
            || name_lower.contains("kernel debugger")
            || name_lower.contains("native wifi filter")
            || name_lower.contains("filter driver")
            || desc_lower.contains("kernel debug")
            || desc_lower.contains("lightweight filter")
            || desc_lower.contains("wfp")
            || desc_lower.contains("virtual")
            || desc_lower.contains("qos")
            || desc_lower.contains("ndis")
            || desc_lower.contains("packet scheduler")
            || desc_lower.contains("filter driver")
            || desc_lower.contains("native wifi filter")
            || desc_lower.contains("tunnel")
            || desc_lower.contains("teredo")
            || desc_lower.contains("ip-https")
        {
            current = adapter.Next;
            continue;
        }

        if adapter.IfType != IF_TYPE_IEEE80211 && adapter.IfType != IF_TYPE_ETHERNET_CSMACD {
            if !name_lower.contains("bluetooth") && !desc_lower.contains("bluetooth") {
                current = adapter.Next;
                continue;
            }
        }

        let if_index = unsafe { adapter.Anonymous1.Anonymous.IfIndex };
        let status = oper_status_to_string(adapter.OperStatus);
        let mac = format_mac(&adapter.PhysicalAddress, adapter.PhysicalAddressLength);
        let link_speed_bps = adapter.TransmitLinkSpeed.max(adapter.ReceiveLinkSpeed);

        interfaces.push(InterfaceInfo {
            name,
            description,
            if_index,
            status,
            mac,
            link_speed_bps,
        });

        current = adapter.Next;
    }

    interfaces
}

fn pwstr_to_string(p: PWSTR) -> String {
    if p.0.is_null() {
        return String::new();
    }
    unsafe {
        let mut len = 0;
        while *p.0.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(p.0, len);
        String::from_utf16_lossy(slice)
    }
}

fn oper_status_to_string(status: IF_OPER_STATUS) -> String {
    match status.0 {
        1 => "Up",
        2 => "Disconnected",
        3 => "Testing",
        4 => "Unknown",
        5 => "Dormant",
        6 => "Not Present",
        7 => "Lower Layer Down",
        _ => "Unknown",
    }
    .to_string()
}

fn format_mac(bytes: &[u8; 8], len: u32) -> String {
    let len = len.min(8) as usize;
    if len == 0 {
        return String::new();
    }
    bytes[..len]
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join("-")
}

#[tauri::command]
pub fn set_interface(
    name: String,
    net_state: State<SharedMonitorState>,
    ping_state: State<SharedPingState>,
) {
    // Reset network monitoring state
    let mut s = net_state.lock();
    s.interface = name;
    s.prev_tx = 0;
    s.prev_rx = 0;
    s.last_sample = None;
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
    s.last_upload = 0.0;
    s.last_download = 0.0;
    s.history.clear();

    // Reset ping state (latency, loss window)
    let mut ps = ping_state.lock();
    *ps = PingState::default();
}

#[tauri::command]
pub fn reset_peaks(state: State<SharedMonitorState>) {
    let mut s = state.lock();
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
}

// ── Window settings commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn set_pill_always_on_top(value: bool, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pill")
        .ok_or_else(|| "pill window not found".to_string())?;
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_pill_opacity(value: f64, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pill")
        .ok_or_else(|| "pill window not found".to_string())?;
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity = '{0}'; document.body.style.opacity = '{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_compact_always_on_top(value: bool, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("compact")
        .ok_or_else(|| "compact window not found".to_string())?;
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_compact_opacity(value: f64, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("compact")
        .ok_or_else(|| "compact window not found".to_string())?;
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity = '{0}'; document.body.style.opacity = '{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hud_always_on_top(value: bool, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "hud window not found".to_string())?;
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_hud_opacity(value: f64, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("hud")
        .ok_or_else(|| "hud window not found".to_string())?;
    let clamped = value.clamp(0.1, 1.0);
    window
        .eval(&format!(
            "document.documentElement.style.opacity = '{0}'; document.body.style.opacity = '{0}';",
            clamped
        ))
        .map_err(|e| e.to_string())
}
