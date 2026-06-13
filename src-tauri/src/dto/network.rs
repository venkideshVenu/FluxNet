use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct InterfaceInfo {
    pub name: String,
    pub description: String,
    pub if_index: u32,
    pub status: String,
    pub mac: String,
    pub link_speed_bps: u64,
    pub interface_type: String,
}

#[derive(Serialize)]
pub struct DashboardSnapshot {
    pub current_upload: f64,
    pub current_download: f64,
    pub peak_upload: f64,
    pub peak_download: f64,
    pub interface_name: String,
    pub is_connected: bool,
    pub history: Vec<HistorySnapshotPoint>,
}

#[derive(Serialize)]
pub struct HistorySnapshotPoint {
    pub upload: f64,
    pub download: f64,
    pub t: u64,
}

#[derive(Serialize, Clone)]
pub struct NetworkStatsEvent {
    pub upload_bps: f64,
    pub download_bps: f64,
    pub interface_name: String,
}
