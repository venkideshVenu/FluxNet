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
    GetAdaptersAddresses, GAA_FLAG_INCLUDE_ALL_INTERFACES, IF_TYPE_ETHERNET_CSMACD,
    IF_TYPE_IEEE80211, IF_TYPE_SOFTWARE_LOOPBACK, IF_TYPE_TUNNEL, IP_ADAPTER_ADDRESSES_LH,
};
use windows::Win32::NetworkManagement::Ndis::IF_OPER_STATUS;
use windows::Win32::Networking::WinSock::AF_UNSPEC;

// ── Centralised widget-label list ────────────────────────────────────────────

pub const WIDGET_LABELS: &[&str] = &["pill", "compact", "hud"];

pub fn is_widget_label(label: &str) -> bool {
    WIDGET_LABELS.contains(&label)
}

// ── Shared types ─────────────────────────────────────────────────────────────

pub type SharedMonitorState = Arc<Mutex<MonitorState>>;

pub struct InterfacesCache {
    pub data: Vec<InterfaceInfo>,
    pub fetched_at: Option<Instant>,
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

const INTERFACES_CACHE_TTL: Duration = Duration::from_secs(3);

pub static INTERFACE_DIRTY: AtomicBool = AtomicBool::new(false);

/// Global shutdown flag — prevents CloseRequested from overwriting widget visibility on exit.
pub static APP_SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

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
    /// Tracks if interface has received any data recently (connectivity indicator)
    pub last_nonzero_at: Option<Instant>,
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
            history: VecDeque::with_capacity(300),
            last_upload: 0.0,
            last_download: 0.0,
            last_nonzero_at: None,
        }
    }
}

// ── Interface type classification ─────────────────────────────────────────────

fn classify_interface_type(if_type: u32, name: &str, description: &str) -> String {
    let name_lower = name.to_lowercase();
    let desc_lower = description.to_lowercase();

    // VPN adapters
    if desc_lower.contains("tap-windows")
        || desc_lower.contains("openvpn")
        || desc_lower.contains("wireguard")
        || desc_lower.contains("nordlynx")
        || name_lower.contains("vpn")
    {
        return "vpn".to_string();
    }

    // Virtual machine adapters
    if desc_lower.contains("hyper-v")
        || desc_lower.contains("vmware")
        || desc_lower.contains("virtualbox")
        || desc_lower.contains("vethernet")
        || desc_lower.contains("docker")
        || desc_lower.contains("wsl")
    {
        return "virtual".to_string();
    }

    // Bluetooth
    if desc_lower.contains("bluetooth") || name_lower.contains("bluetooth") {
        return "bluetooth".to_string();
    }

    // Cellular
    if desc_lower.contains("cellular")
        || desc_lower.contains("mobile broadband")
        || desc_lower.contains("wwanpp")
    {
        return "cellular".to_string();
    }

    // USB tethering / USB ethernet
    if desc_lower.contains("rndis")
        || desc_lower.contains("remote ndis")
        || desc_lower.contains("usb ethernet")
        || desc_lower.contains("android")
        || desc_lower.contains("iphone")
    {
        return "usb".to_string();
    }

    // By IF_TYPE
    match if_type {
        t if t == IF_TYPE_IEEE80211 => "wifi".to_string(),
        t if t == IF_TYPE_ETHERNET_CSMACD => "ethernet".to_string(),
        t if t == IF_TYPE_TUNNEL => "tunnel".to_string(),
        _ => "other".to_string(),
    }
}

// ── Interface filtering — should this adapter be shown? ───────────────────────

fn is_noise_interface(name: &str, description: &str, if_type: u32) -> bool {
    let name_lower = name.to_lowercase();
    let desc_lower = description.to_lowercase();

    // Always filter loopback
    if if_type == IF_TYPE_SOFTWARE_LOOPBACK {
        return true;
    }

    // Filter known noise interfaces
    let noise_patterns_name = [
        "local area connection*",
        "wi-fi direct",
        "wifi direct",
        "kernel debugger",
        "native wifi filter",
        "virtual wifi filter",
        "microsoft wi-fi direct",
    ];

    let noise_patterns_desc = [
        "kernel debug",
        "lightweight filter",
        "wfp ",
        "qos packet scheduler",
        "teredo",
        "ip-https",
        "isatap",
        "6to4",
        "wan miniport",
        "microsoft kernel debug",
        "ndis bridge",
        "wi-fi filter driver",
        "wifi filter driver",
        "npcap",
        "winpcap",
        "packet scheduler miniport",
    ];

    for pattern in &noise_patterns_name {
        if name_lower.contains(pattern) {
            return true;
        }
    }

    for pattern in &noise_patterns_desc {
        if desc_lower.contains(pattern) {
            return true;
        }
    }

    false
}

/// Check if an interface name exists in sysinfo's network list.
/// This validates that we can actually read counters for it.
fn interface_exists_in_sysinfo(networks: &Networks, name: &str) -> bool {
    networks.iter().any(|(n, _)| n == name)
}

// ── Interface auto-selection ──────────────────────────────────────────────────

fn auto_select_interface() -> String {
    let detailed = read_interfaces_from_windows();
    // Prefer Ethernet that is Up
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "ethernet" {
            return iface.name.clone();
        }
    }
    // Then Wi-Fi
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "wifi" {
            return iface.name.clone();
        }
    }
    // Then USB (tethering)
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "usb" {
            return iface.name.clone();
        }
    }
    // Any UP physical adapter (not virtual/vpn/tunnel)
    for iface in &detailed {
        if iface.status == "Up"
            && !matches!(
                iface.interface_type.as_str(),
                "virtual" | "tunnel" | "bluetooth"
            )
        {
            return iface.name.clone();
        }
    }
    String::new()
}

// ── Sampling ──────────────────────────────────────────────────────────────────

pub fn tick_sample_with_networks(s: &mut MonitorState, networks: &Networks, now_ts: i64) {
    if INTERFACE_DIRTY.swap(false, Ordering::Relaxed) {
        s.prev_tx = 0;
        s.prev_rx = 0;
        s.last_sample = None;
    }

    let now = Instant::now();

    if let Some((tx, rx)) = read_total_counters(networks, &s.interface) {
        if s.last_sample.is_none() {
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

        if s.history.len() >= 300 {
            s.history.pop_front();
        }
        s.history.push_back(HistoryPoint {
            upload,
            download,
            timestamp: now_ts,
        });

        // Track connectivity — if any traffic in last 30s, consider connected
        if upload > 0.0 || download > 0.0 {
            s.last_nonzero_at = Some(now);
        }

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
        s.last_nonzero_at = None;
    }
}

/// Determine if the monitored interface is "connected" (has recent traffic or is operationally up)
fn is_interface_connected(state: &MonitorState) -> bool {
    if state.interface.is_empty() {
        return false;
    }
    // If we received any traffic in the last 30 seconds, consider connected
    if let Some(last) = state.last_nonzero_at {
        if last.elapsed() < Duration::from_secs(30) {
            return true;
        }
    }
    // If we have a valid sample (interface exists), consider it up
    state.last_sample.is_some()
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
pub fn get_dashboard_snapshot(state: State<SharedMonitorState>) -> DashboardSnapshot {
    let s = state.lock();
    let history: Vec<HistorySnapshotPoint> = s
        .history
        .iter()
        .map(|p| HistorySnapshotPoint {
            upload: p.upload,
            download: p.download,
            t: p.timestamp as u64,
        })
        .collect();

    let connected = is_interface_connected(&s);

    DashboardSnapshot {
        current_upload: s.last_upload,
        current_download: s.last_download,
        peak_upload: s.peak_upload,
        peak_download: s.peak_download,
        interface_name: s.interface.clone(),
        is_connected: connected,
        history,
    }
}

#[tauri::command]
pub fn get_interfaces(cache: State<SharedInterfacesCache>) -> Vec<InterfaceInfo> {
    {
        let c = cache.lock();
        if let Some(at) = c.fetched_at {
            if at.elapsed() < INTERFACES_CACHE_TTL {
                return c.data.clone();
            }
        }
    }

    let fresh = read_interfaces_from_windows();

    let mut c = cache.lock();
    if c.fetched_at
        .map_or(true, |at| at.elapsed() >= INTERFACES_CACHE_TTL)
    {
        c.data = fresh.clone();
        c.fetched_at = Some(Instant::now());
    }
    c.data.clone()
}

#[tauri::command]
pub fn set_interface(
    name: String,
    net_state: State<SharedMonitorState>,
    ping_state: State<SharedPingState>,
    cache: State<SharedInterfacesCache>,
) -> Result<(), String> {
    // Validate the interface exists and is Up
    {
        let c = cache.lock();
        if let Some(iface) = c.data.iter().find(|i| i.name == name) {
            if iface.status != "Up" {
                return Err(format!(
                    "Interface '{}' is not Up (status: {})",
                    name, iface.status
                ));
            }
        }
    }

    {
        let mut s = net_state.lock();
        s.interface = name;
        s.peak_upload = 0.0;
        s.peak_download = 0.0;
        s.last_upload = 0.0;
        s.last_download = 0.0;
        s.history.clear();
        s.last_nonzero_at = None;
    }

    INTERFACE_DIRTY.store(true, Ordering::Relaxed);

    let mut ps = ping_state.lock();
    *ps = PingState::default();

    cache.lock().fetched_at = None;

    Ok(())
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
        let name = pwstr_to_string(adapter.FriendlyName);
        if name.is_empty() {
            current = adapter.Next;
            continue;
        }
        let description = pwstr_to_string(adapter.Description);

        if is_noise_interface(&name, &description, adapter.IfType) {
            current = adapter.Next;
            continue;
        }

        let if_index = unsafe { adapter.Anonymous1.Anonymous.IfIndex };
        let status = oper_status_to_string(adapter.OperStatus);
        let mac = format_mac(&adapter.PhysicalAddress, adapter.PhysicalAddressLength);
        let link_speed_bps = adapter.TransmitLinkSpeed.max(adapter.ReceiveLinkSpeed);
        let interface_type = classify_interface_type(adapter.IfType, &name, &description);

        interfaces.push(InterfaceInfo {
            name,
            description,
            if_index,
            status,
            mac,
            link_speed_bps,
            interface_type,
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

pub fn select_interface_outside_lock(networks: &Networks) -> String {
    let selected = auto_select_interface();
    if !selected.is_empty() {
        // Verify it actually exists in sysinfo
        if interface_exists_in_sysinfo(networks, &selected) {
            return selected;
        }
    }
    // Last resort
    for (name, _) in networks {
        if name != "lo" && name != "Loopback Pseudo-Interface 1" {
            return name.clone();
        }
    }
    String::new()
}
