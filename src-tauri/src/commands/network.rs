use crate::commands::ping::{PingState, SharedPingState};
use crate::dto::network::{DashboardSnapshot, HistorySnapshotPoint, InterfaceInfo};
use crate::monitor::bandwidth::{NetworkStats, calculate_speed, read_total_counters};

use parking_lot::Mutex;
use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use sysinfo::Networks;
use tauri::{AppHandle, Manager, State};
#[cfg(windows)]
use windows::Win32::Foundation::{ERROR_BUFFER_OVERFLOW, NO_ERROR};
#[cfg(windows)]
use windows::Win32::NetworkManagement::IpHelper::{
    GAA_FLAG_INCLUDE_ALL_INTERFACES, GetAdaptersAddresses, IP_ADAPTER_ADDRESSES_LH,
};
#[cfg(windows)]
use windows::Win32::NetworkManagement::Ndis::IF_OPER_STATUS;
#[cfg(windows)]
use windows::Win32::Networking::WinSock::AF_UNSPEC;
#[cfg(windows)]
use windows::core::PWSTR;

// IANA ifType values (RFC 1213 / IANAifType-MIB). These match the Windows
// `IF_TYPE_*` constants but are defined here so classification compiles on
// every platform.
#[cfg_attr(not(windows), allow(dead_code))]
const IF_TYPE_ETHERNET_CSMACD: u32 = 6;
#[cfg_attr(not(windows), allow(dead_code))]
const IF_TYPE_SOFTWARE_LOOPBACK: u32 = 24;
#[cfg_attr(not(windows), allow(dead_code))]
const IF_TYPE_IEEE80211: u32 = 71;
#[cfg_attr(not(windows), allow(dead_code))]
const IF_TYPE_TUNNEL: u32 = 131;

// ── Centralised widget-label list ────────────────────────────────────────────

pub const WIDGET_LABELS: &[&str] = &["pill", "compact", "hud"];

pub fn is_widget_label(label: &str) -> bool {
    WIDGET_LABELS.contains(&label)
}

// ── Shared types ─────────────────────────────────────────────────────────────

pub type SharedMonitorState = Arc<Mutex<MonitorState>>;

#[derive(Default)]
pub struct InterfacesCache {
    pub data: Vec<InterfaceInfo>,
    pub fetched_at: Option<Instant>,
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
    /// Measured length of the last sample interval, in milliseconds.
    pub last_elapsed_ms: i64,
    /// Tracks if interface has received any data recently (connectivity indicator)
    pub last_nonzero_at: Option<Instant>,
}

pub const MAX_HISTORY_POINTS: usize = 1800;

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            prev_tx: 0,
            prev_rx: 0,
            last_sample: None,
            interface: String::new(),
            peak_upload: 0.0,
            peak_download: 0.0,
            history: VecDeque::with_capacity(MAX_HISTORY_POINTS),
            last_upload: 0.0,
            last_download: 0.0,
            last_elapsed_ms: 0,
            last_nonzero_at: None,
        }
    }
}

// ── Interface type classification ─────────────────────────────────────────────

#[cfg_attr(not(windows), allow(dead_code))]
fn classify_interface_type(if_type: u32, name: &str, description: &str) -> String {
    let name_lower = name.to_lowercase();
    let desc_lower = description.to_lowercase();

    if desc_lower.contains("tap-windows")
        || desc_lower.contains("openvpn")
        || desc_lower.contains("wireguard")
        || desc_lower.contains("nordlynx")
        || name_lower.contains("vpn")
    {
        return "vpn".to_string();
    }

    if desc_lower.contains("hyper-v")
        || desc_lower.contains("vmware")
        || desc_lower.contains("virtualbox")
        || desc_lower.contains("vethernet")
        || desc_lower.contains("docker")
        || desc_lower.contains("wsl")
    {
        return "virtual".to_string();
    }

    if desc_lower.contains("bluetooth") || name_lower.contains("bluetooth") {
        return "bluetooth".to_string();
    }

    if desc_lower.contains("cellular")
        || desc_lower.contains("mobile broadband")
        || desc_lower.contains("wwanpp")
    {
        return "cellular".to_string();
    }

    if desc_lower.contains("rndis")
        || desc_lower.contains("remote ndis")
        || desc_lower.contains("usb ethernet")
        || desc_lower.contains("android")
        || desc_lower.contains("iphone")
    {
        return "usb".to_string();
    }

    match if_type {
        t if t == IF_TYPE_IEEE80211 => "wifi".to_string(),
        t if t == IF_TYPE_ETHERNET_CSMACD => "ethernet".to_string(),
        t if t == IF_TYPE_TUNNEL => "tunnel".to_string(),
        _ => "other".to_string(),
    }
}

// ── Interface filtering — should this adapter be shown? ───────────────────────

#[cfg_attr(not(windows), allow(dead_code))]
fn is_noise_interface(name: &str, description: &str, if_type: u32) -> bool {
    let name_lower = name.to_lowercase();
    let desc_lower = description.to_lowercase();

    if if_type == IF_TYPE_SOFTWARE_LOOPBACK {
        return true;
    }

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

fn interface_exists_in_sysinfo(networks: &Networks, name: &str) -> bool {
    networks.iter().any(|(n, _)| n == name)
}

// ── Interface auto-selection ──────────────────────────────────────────────────

fn auto_select_interface() -> String {
    let detailed = read_interfaces();
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "ethernet" {
            return iface.name.clone();
        }
    }
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "wifi" {
            return iface.name.clone();
        }
    }
    for iface in &detailed {
        if iface.status == "Up" && iface.interface_type == "usb" {
            return iface.name.clone();
        }
    }
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

        if s.history.len() >= MAX_HISTORY_POINTS {
            s.history.pop_front();
        }
        s.history.push_back(HistoryPoint {
            upload,
            download,
            timestamp: now_ts,
        });

        if upload > 0.0 || download > 0.0 {
            s.last_nonzero_at = Some(now);
        }

        s.prev_tx = tx;
        s.prev_rx = rx;
        s.last_sample = Some(now);
        s.last_upload = upload;
        s.last_download = download;
        s.last_elapsed_ms = (elapsed * 1000.0).round() as i64;
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

fn is_interface_connected(state: &MonitorState) -> bool {
    if state.interface.is_empty() {
        return false;
    }
    if let Some(last) = state.last_nonzero_at
        && last.elapsed() < Duration::from_secs(30)
    {
        return true;
    }
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

    // Only send last 600 points to reduce serialization/IPC overhead
    let skip = s.history.len().saturating_sub(600);
    let history: Vec<HistorySnapshotPoint> = s
        .history
        .iter()
        .skip(skip)
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
pub fn get_interfaces(app: AppHandle) -> Result<Vec<InterfaceInfo>, String> {
    let cache = app
        .try_state::<SharedInterfacesCache>()
        .ok_or_else(|| "Interfaces cache not yet initialized".to_string())?;

    {
        let c = cache.lock();
        if let Some(at) = c.fetched_at
            && at.elapsed() < INTERFACES_CACHE_TTL
        {
            return Ok(c.data.clone());
        }
    }

    let fresh = read_interfaces();

    let mut c = cache.lock();
    if c.fetched_at
        .is_none_or(|at| at.elapsed() >= INTERFACES_CACHE_TTL)
    {
        c.data = fresh.clone();
        c.fetched_at = Some(Instant::now());
    }
    Ok(c.data.clone())
}

#[tauri::command]
pub fn set_interface(name: String, app: AppHandle) -> Result<(), String> {
    let net_state = app
        .try_state::<SharedMonitorState>()
        .ok_or_else(|| "Monitor state not yet initialized".to_string())?;
    let ping_state = app
        .try_state::<SharedPingState>()
        .ok_or_else(|| "Ping state not yet initialized".to_string())?;
    let cache = app
        .try_state::<SharedInterfacesCache>()
        .ok_or_else(|| "Interfaces cache not yet initialized".to_string())?;

    // Refresh cache before validation to ensure we have the latest interfaces
    {
        let mut c = cache.lock();
        let fresh = read_interfaces();
        c.data = fresh;
        c.fetched_at = Some(Instant::now());
    }

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
        } else {
            return Err(format!("Interface '{}' not found", name));
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
        // Reset sampling state so next tick re-initializes counters
        s.prev_tx = 0;
        s.prev_rx = 0;
        s.last_sample = None;
    }

    INTERFACE_DIRTY.store(true, Ordering::Relaxed);

    let mut ps = ping_state.lock();
    *ps = PingState::default();

    // Invalidate cache so next get_interfaces call refreshes
    cache.lock().fetched_at = None;

    Ok(())
}

#[tauri::command]
pub fn reset_peaks(state: State<SharedMonitorState>) {
    let mut s = state.lock();
    s.peak_upload = 0.0;
    s.peak_download = 0.0;
}

// ── Adapter enumeration ───────────────────────────────────────────────────────

/// Lists network adapters with their type, status and link speed.
///
/// On Windows this uses the IP Helper API. Other platforms get a best-effort
/// listing from `sysinfo` so the app can run there during development.
pub fn read_interfaces() -> Vec<InterfaceInfo> {
    #[cfg(windows)]
    {
        read_interfaces_from_windows()
    }
    #[cfg(not(windows))]
    {
        read_interfaces_from_sysinfo()
    }
}

#[cfg(not(windows))]
fn read_interfaces_from_sysinfo() -> Vec<InterfaceInfo> {
    let networks = Networks::new_with_refreshed_list();
    let mut interfaces: Vec<InterfaceInfo> = networks
        .iter()
        .filter(|(name, _)| !name.starts_with("lo"))
        .enumerate()
        .map(|(i, (name, data))| {
            let interface_type = if name.starts_with("en") || name.starts_with("eth") {
                "ethernet"
            } else if name.starts_with("wl") {
                "wifi"
            } else if name.starts_with("utun") || name.starts_with("tun") {
                "tunnel"
            } else {
                "virtual"
            };
            InterfaceInfo {
                name: name.clone(),
                description: name.clone(),
                if_index: i as u32,
                status: "Up".to_string(),
                mac: data
                    .mac_address()
                    .to_string()
                    .to_uppercase()
                    .replace(':', "-"),
                link_speed_bps: 0,
                interface_type: interface_type.to_string(),
            }
        })
        .collect();
    interfaces.sort_by(|a, b| a.name.cmp(&b.name));
    interfaces
}

#[cfg(windows)]
fn read_interfaces_from_windows() -> Vec<InterfaceInfo> {
    let mut interfaces = Vec::new();

    // `IP_ADAPTER_ADDRESSES_LH` contains pointers, so the buffer must be
    // 8-byte aligned: back it with u64s rather than bytes. Retry when an
    // adapter appears between the size query and the real call.
    let mut buf_len: u32 = 16 * 1024;
    let mut buffer: Vec<u64>;
    let mut attempts = 0;
    loop {
        buffer = vec![0u64; (buf_len as usize).div_ceil(8)];
        let ret = unsafe {
            GetAdaptersAddresses(
                AF_UNSPEC.0 as u32,
                GAA_FLAG_INCLUDE_ALL_INTERFACES,
                None,
                Some(buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH),
                &mut buf_len,
            )
        };
        attempts += 1;
        if ret == NO_ERROR.0 {
            break;
        }
        if ret != ERROR_BUFFER_OVERFLOW.0 || attempts >= 4 {
            tracing::warn!("GetAdaptersAddresses failed with code {ret}");
            return interfaces;
        }
    }
    let adapter_ptr = buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH;
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

#[cfg(windows)]
fn pwstr_to_string(p: PWSTR) -> String {
    if p.is_null() {
        return String::new();
    }
    unsafe { p.to_string().unwrap_or_default() }
}

#[cfg(windows)]
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

#[cfg(windows)]
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
    if !selected.is_empty() && interface_exists_in_sysinfo(networks, &selected) {
        return selected;
    }
    busiest_interface(networks.iter().map(|(name, data)| {
        (
            name.as_str(),
            data.total_received() + data.total_transmitted(),
        )
    }))
}

/// Fallback choice when no adapter is clearly "Up": the non-loopback
/// interface that has carried the most traffic since boot, ties broken by
/// name so the result is deterministic (not `HashMap` iteration order).
fn busiest_interface<'a>(candidates: impl Iterator<Item = (&'a str, u64)>) -> String {
    candidates
        .filter(|(name, _)| !is_loopback_name(name))
        .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(a.0)))
        .map(|(name, _)| name.to_string())
        .unwrap_or_default()
}

fn is_loopback_name(name: &str) -> bool {
    name == "lo" || name.starts_with("lo0") || name.starts_with("Loopback Pseudo-Interface")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_by_description_before_if_type() {
        let wifi = IF_TYPE_IEEE80211;
        assert_eq!(
            classify_interface_type(wifi, "Wi-Fi", "Intel Wi-Fi 6E AX211"),
            "wifi"
        );
        assert_eq!(
            classify_interface_type(6, "Ethernet", "Realtek PCIe GbE"),
            "ethernet"
        );
        assert_eq!(
            classify_interface_type(6, "NordLynx", "NordLynx Tunnel"),
            "vpn"
        );
        assert_eq!(
            classify_interface_type(53, "OpenVPN", "TAP-Windows Adapter V9"),
            "vpn"
        );
        assert_eq!(
            classify_interface_type(6, "vEthernet (WSL)", "Hyper-V Virtual Ethernet Adapter"),
            "virtual"
        );
        assert_eq!(
            classify_interface_type(6, "Bluetooth Network Connection", "Bluetooth Device (PAN)"),
            "bluetooth"
        );
        assert_eq!(
            classify_interface_type(6, "Ethernet 3", "Remote NDIS based Internet Sharing Device"),
            "usb"
        );
        assert_eq!(
            classify_interface_type(243, "Cellular", "Mobile Broadband"),
            "cellular"
        );
        assert_eq!(classify_interface_type(IF_TYPE_TUNNEL, "x", "y"), "tunnel");
        assert_eq!(classify_interface_type(1, "x", "y"), "other");
    }

    #[test]
    fn hides_loopback_and_driver_noise() {
        assert!(is_noise_interface(
            "Loopback",
            "Software Loopback",
            IF_TYPE_SOFTWARE_LOOPBACK
        ));
        assert!(is_noise_interface(
            "Local Area Connection* 2",
            "Wi-Fi Direct Virtual",
            71
        ));
        assert!(is_noise_interface("Ethernet", "WAN Miniport (IP)", 6));
        assert!(is_noise_interface(
            "Ethernet 4",
            "Npcap Loopback Adapter",
            6
        ));
        assert!(!is_noise_interface("Wi-Fi", "Intel Wi-Fi 6E AX211", 71));
        assert!(!is_noise_interface("Ethernet", "Realtek PCIe GbE", 6));
    }

    #[test]
    fn fallback_picks_busiest_non_loopback_interface() {
        let ifaces = [
            ("Loopback Pseudo-Interface 1", 9_000_000),
            ("vEthernet (WSL)", 1_000),
            ("Wi-Fi", 5_000_000),
            ("Ethernet", 0),
        ];
        assert_eq!(busiest_interface(ifaces.into_iter()), "Wi-Fi");
    }

    #[test]
    fn fallback_is_deterministic_on_ties_and_empty() {
        let ifaces = [("b", 0), ("a", 0), ("lo", 0)];
        assert_eq!(busiest_interface(ifaces.into_iter()), "a");
        assert_eq!(busiest_interface(std::iter::empty()), "");
    }

    #[test]
    fn widget_labels_are_recognised() {
        for label in WIDGET_LABELS {
            assert!(is_widget_label(label));
        }
        assert!(!is_widget_label("main"));
    }
}
