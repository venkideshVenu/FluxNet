use crate::commands::ping::{PingState, SharedPingState};
use crate::dto::network::{DashboardSnapshot, HistorySnapshotPoint, InterfaceInfo};
use crate::monitor::bandwidth::{calculate_speed, read_total_counters, NetworkStats};

use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::Networks;
use tauri::State;
use windows::core::PWSTR;
use windows::Win32::Foundation::{ERROR_BUFFER_OVERFLOW, NO_ERROR};
use windows::Win32::NetworkManagement::IpHelper::{
    GetAdaptersAddresses, GAA_FLAG_INCLUDE_ALL_INTERFACES, IF_TYPE_SOFTWARE_LOOPBACK,
    IP_ADAPTER_ADDRESSES_LH,
};
use windows::Win32::NetworkManagement::Ndis::IF_OPER_STATUS;
use windows::Win32::Networking::WinSock::AF_UNSPEC;

// ── Centralised widget-label list (A7) ───────────────────────────────────────

/// All floating-widget window labels.  Add new widgets here — one place only.
pub const WIDGET_LABELS: &[&str] = &["pill", "compact", "hud"];

pub fn is_widget_label(label: &str) -> bool {
    WIDGET_LABELS.contains(&label)
}

// ── Shared types ─────────────────────────────────────────────────────────────

pub type SharedMonitorState = Arc<Mutex<MonitorState>>;

pub struct InterfacesCache {
    pub data: Vec<InterfaceInfo>,
    pub fetched_at: Option<Instant>, // FIX S4: Instant, not SystemTime
}

impl Default for InterfacesCache {
    fn default() -> Self {
        Self {
            data: Vec::new(),
            fetched_at: None,
        }
    }
}

pub type SharedInterfacesCache = Arc<Mutex<InterfacesCache>>;

const INTERFACES_CACHE_TTL: Duration = Duration::from_secs(10);

pub static INTERFACE_DIRTY: AtomicBool = AtomicBool::new(false);

pub struct HistoryPoint {
    pub upload: f64,
    pub download: f64,
    pub timestamp: i64,
}

pub struct MonitorState {
    pub prev_tx: u64,
    pub prev_rx: u64,
    pub last_sample: Option<Instant>,
    pub interface: String,
    pub peak_upload: f64,
    pub peak_download: f64,
    pub history: VecDeque<HistoryPoint>,
    pub last_upload: f64,
    pub last_download: f64,
    // interfaces_cache REMOVED from here — now lives in SharedInterfacesCache (FIX R2)
}

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            prev_tx: 0,
            prev_rx: 0,
            last_sample: None,
            interface: String::new(),
            peak_upload: 0.0,
            peak_download: 0.0,
            history: VecDeque::with_capacity(120),
            last_upload: 0.0,
            last_download: 0.0,
        }
    }
}

// ── Interface auto-selection ──────────────────────────────────────────────────

fn auto_select_interface() -> String {
    let detailed = read_interfaces_from_windows();
    // Prefer Ethernet
    for iface in &detailed {
        if iface.status == "Up" {
            let n = iface.name.to_lowercase();
            let d = iface.description.to_lowercase();
            if n.contains("ethernet") || d.contains("ethernet") {
                return iface.name.clone();
            }
        }
    }
    // Fall back to Wi-Fi
    for iface in &detailed {
        if iface.status == "Up" {
            let n = iface.name.to_lowercase();
            let d = iface.description.to_lowercase();
            if n.contains("wi-fi") || n.contains("wlan") || d.contains("wireless") {
                return iface.name.clone();
            }
        }
    }
    // Any UP adapter
    detailed
        .iter()
        .find(|i| i.status == "Up")
        .map(|i| i.name.clone())
        .unwrap_or_default()
}

// ── Sampling ──────────────────────────────────────────────────────────────────

/// Called by the sampler every tick.  The caller has already released all other
/// locks; `s` is the only lock held during this function.
pub fn tick_sample_with_networks(s: &mut MonitorState, networks: &Networks, now_ts: i64) {
    // FIX R8: if set_interface() fired, discard stale prev counters so the first
    // tick after a switch does not produce a false speed reading.
    if INTERFACE_DIRTY.swap(false, Ordering::Relaxed) {
        s.prev_tx = 0;
        s.prev_rx = 0;
        s.last_sample = None;
    }

    // the MonitorState lock is held.
    let now = Instant::now();

    if let Some((tx, rx)) = read_total_counters(networks, &s.interface) {
        if s.last_sample.is_none() {
            // Priming tick — record baseline counters only
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

        if s.history.len() >= 120 {
            s.history.pop_front();
        }
        s.history.push_back(HistoryPoint {
            upload,
            download,
            timestamp: now_ts,
        });

        s.prev_tx = tx;
        s.prev_rx = rx;
        s.last_sample = Some(now);
        s.last_upload = upload;
        s.last_download = download;
    } else {
        tracing::warn!("Interface '{}' no longer exists – resetting", s.interface);
        s.interface.clear();
        s.prev_tx = 0;
        s.prev_rx = 0;
        s.last_sample = None;
        s.last_upload = 0.0;
        s.last_download = 0.0;
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_network_stats(state: State<SharedMonitorState>) -> NetworkStats {
    let s = state.lock();
    NetworkStats {
        upload_bytes_per_sec: s.last_upload,
        download_bytes_per_sec: s.last_download,
        interface_name: s.interface.clone(),
    }
}

#[tauri::command]
pub fn get_dashboard_snapshot(
    state: State<SharedMonitorState>,
    since_ts: Option<i64>,
) -> DashboardSnapshot {
    let s = state.lock();
    let history: Vec<HistorySnapshotPoint> = match since_ts {
        Some(since) => s
            .history
            .iter()
            .filter(|p| p.timestamp > since)
            .map(|p| HistorySnapshotPoint {
                upload: p.upload,
                download: p.download,
                t: p.timestamp as u64,
            })
            .collect(),
        None => s
            .history
            .iter()
            .map(|p| HistorySnapshotPoint {
                upload: p.upload,
                download: p.download,
                t: p.timestamp as u64,
            })
            .collect(),
    };
    DashboardSnapshot {
        current_upload: s.last_upload,
        current_download: s.last_download,
        peak_upload: s.peak_upload,
        peak_download: s.peak_download,
        interface_name: s.interface.clone(),
        history,
    }
}

#[tauri::command]
pub fn get_interfaces(cache: State<SharedInterfacesCache>) -> Vec<InterfaceInfo> {
    // Fast path — check under lock
    {
        let c = cache.lock();
        if let Some(at) = c.fetched_at {
            if at.elapsed() < INTERFACES_CACHE_TTL {
                return c.data.clone();
            }
        }
    }

    // Slow path — fetch outside the lock (Windows API can take 5–50 ms)
    let fresh = read_interfaces_from_windows();

    // Write back under lock, with a second-check to avoid double-fetch races
    let mut c = cache.lock();
    if c.fetched_at
        .map_or(true, |at| at.elapsed() >= INTERFACES_CACHE_TTL)
    {
        c.data = fresh.clone();
        c.fetched_at = Some(Instant::now()); // FIX S4: Instant, not SystemTime
    }
    c.data.clone()
}

#[tauri::command]
pub fn set_interface(
    name: String,
    net_state: State<SharedMonitorState>,
    ping_state: State<SharedPingState>,
    cache: State<SharedInterfacesCache>,
) {
    {
        let mut s = net_state.lock();
        s.interface = name;
        // prev_tx/rx and last_sample are reset via the INTERFACE_DIRTY flag on the
        // next sampler tick so we don't hold the lock across two state objects.
        s.peak_upload = 0.0;
        s.peak_download = 0.0;
        s.last_upload = 0.0;
        s.last_download = 0.0;
        s.history.clear();
    }

    // FIX R8: signal the sampler to discard stale counters on the next tick
    INTERFACE_DIRTY.store(true, Ordering::Relaxed);

    // Reset ping state
    let mut ps = ping_state.lock();
    *ps = PingState::default();

    // Invalidate the interfaces cache
    cache.lock().fetched_at = None;
}

#[tauri::command]
pub fn reset_peaks(state: State<SharedMonitorState>) {
    let mut s = state.lock();
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
}

// ── Windows adapter enumeration ───────────────────────────────────────────────

pub fn read_interfaces_from_windows() -> Vec<InterfaceInfo> {
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

        let is_noise = name_lower.contains("local area connection*")
            || name_lower.contains("wi-fi direct")
            || name_lower.contains("wifi direct")
            || name_lower.contains("kernel debugger")
            || name_lower.contains("native wifi filter")
            || desc_lower.contains("kernel debug")
            || desc_lower.contains("lightweight filter")
            || desc_lower.contains("wfp")
            || desc_lower.contains("qos packet scheduler")
            || desc_lower.contains("teredo")
            || desc_lower.contains("ip-https");

        if is_noise {
            current = adapter.Next;
            continue;
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

// ── Private helpers ───────────────────────────────────────────────────────────

fn pwstr_to_string(p: PWSTR) -> String {
    if p.is_null() {
        return String::new();
    }
    unsafe { p.to_string().unwrap_or_default() }
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

// ── Interface auto-select helper exposed for the sampler ─────────────────────

/// Called by the sampler OUTSIDE any MonitorState lock (FIX N2).
pub fn select_interface_outside_lock(networks: &Networks) -> String {
    let selected = auto_select_interface();
    if !selected.is_empty() {
        return selected;
    }
    // Last resort: use whatever sysinfo exposes (non-loopback)
    for (name, _) in networks {
        if name != "lo" && name != "Loopback Pseudo-Interface 1" {
            return name.clone();
        }
    }
    String::new()
}
