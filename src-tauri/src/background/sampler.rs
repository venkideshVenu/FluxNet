use crate::commands::network::{
    SharedMonitorState, select_interface_outside_lock, tick_sample_with_networks,
};
use crate::commands::ping::SharedPingState;
use crate::monitor::bandwidth::load_networks;
use crate::monitor::ping::measure_ping;
use crate::storage::DbState;
use crate::storage::aggregation::{catch_up, refresh_today};
use crate::storage::local_time::hour_start;
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use chrono::Local;
use parking_lot::Mutex;
use std::net::IpAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

/// Fixed backend sampling interval — always 500ms for accurate measurements.
const SAMPLER_INTERVAL_MS: u64 = 500;

const PING_INTERVAL_TICKS: u32 = 10; // 10 × 500ms = 5s

/// How often to do a full interface-list refresh (detecting hot-plugged
/// adapters). 600 ticks × 500ms = 5 minutes; `refresh()` updates counters on
/// every other tick.
const IFACE_LIST_REFRESH_TICKS: u32 = 600; // 5 minutes

pub type SamplerHandle = Arc<Mutex<Option<JoinHandle<()>>>>;

// ── Rollups ───────────────────────────────────────────────────────────────────

/// Brings hourly/daily/monthly rollups up to date. Runs at startup and on
/// every local hour change, so hours missed during sleep are repaired.
fn run_catch_up(db: &DbState) {
    let conn = db.0.lock();
    match catch_up(&conn, &Local, Local::now().timestamp()) {
        Ok(r) if r.hours + r.months > 0 => tracing::info!(
            "Rolled up {} hour(s), {} day(s), {} month(s)",
            r.hours,
            r.days,
            r.months
        ),
        Ok(_) => {}
        Err(e) => tracing::warn!("Rollup catch-up failed: {e}"),
    }
}

/// Runs a ping on its own task so a slow or blocked ICMP probe (up to 2 s)
/// never stalls the 500 ms sampling loop.
fn spawn_ping(app: &AppHandle, ping_state: &SharedPingState, in_flight: &Arc<AtomicBool>) {
    if in_flight.swap(true, Ordering::AcqRel) {
        return;
    }
    let app = app.clone();
    let ping_state = ping_state.clone();
    let in_flight = in_flight.clone();
    tauri::async_runtime::spawn(async move {
        let target = IpAddr::from([1, 1, 1, 1]);
        let result = measure_ping(target).await;
        let stats = {
            let mut ps = ping_state.lock();
            ps.update(result.latency_ms, result.loss);
            ps.current_stats()
        };
        if any_window_visible(&app) {
            let _ = app.emit("ping-stats", &stats);
        }
        in_flight.store(false, Ordering::Release);
    });
}

fn any_window_visible(app: &AppHandle) -> bool {
    app.webview_windows()
        .values()
        .any(|w| w.is_visible().unwrap_or(false))
}

/// Starts the background sampling loop at a fixed 500ms rate.
/// Backfill runs asynchronously on a blocking thread so it does NOT block the UI.
pub fn start_sampler(
    monitor_state: SharedMonitorState,
    db: DbState,
    ping_state: SharedPingState,
    cancel_token: CancellationToken,
    app_handle: AppHandle,
) -> SamplerHandle {
    let handle: JoinHandle<()> = tauri::async_runtime::spawn(async move {
        // Catch up rollups on a blocking thread — does not delay the UI
        {
            let db_clone = db.clone();
            let _ = tokio::task::spawn_blocking(move || run_catch_up(&db_clone)).await;
        }

        let mut sample_interval = tokio::time::interval(Duration::from_millis(SAMPLER_INTERVAL_MS));
        sample_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        // Cleanup + WAL checkpoint every 60 seconds
        let mut cleanup_interval = tokio::time::interval(Duration::from_secs(60));
        cleanup_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        // Partial daily snapshot every 10 seconds
        let mut daily_snapshot_interval = tokio::time::interval(Duration::from_secs(10));
        daily_snapshot_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut tick_counter = 0u32;
        let mut last_hour_start: Option<i64> = None;
        let ping_in_flight = Arc::new(AtomicBool::new(false));

        // Create once; refresh() updates counters, and the full list is
        // re-read every 5 minutes to detect hot-plugged adapters.
        let mut networks = load_networks();

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("Sampler shutting down – performing final WAL checkpoint");
                    let db_clone = db.clone();
                    let _ = tokio::task::spawn_blocking(move || {
                        let conn = db_clone.0.lock();
                        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    })
                    .await;
                    break;
                }

                _ = sample_interval.tick() => {
                    tick_counter = tick_counter.wrapping_add(1);

                    let now_ts = Local::now().timestamp();

                    // Without an adapter list (only if the OS refused to give
                    // one), try again next tick.
                    let networks = match &mut networks {
                        Some(n) if tick_counter.is_multiple_of(IFACE_LIST_REFRESH_TICKS) => {
                            // Also drops adapters that have been removed.
                            n.refresh(true);
                            n
                        }
                        Some(n) => {
                            n.refresh(false);
                            n
                        }
                        None => match load_networks() {
                            Some(n) => networks.insert(n),
                            None => continue,
                        },
                    };

                    // Auto-select interface if none is set
                    let needs_selection = {
                        let s = monitor_state.lock();
                        s.interface.is_empty()
                    };
                    if needs_selection {
                        let selected = select_interface_outside_lock(networks);
                        if !selected.is_empty() {
                            let mut s = monitor_state.lock();
                            if s.interface.is_empty() {
                                s.interface = selected;
                            }
                        }
                    }

                    // If the selected interface has disappeared, force a list refresh now
                    let iface_missing = {
                        let s = monitor_state.lock();
                        !s.interface.is_empty()
                            && !networks.contains_key(std::ffi::OsStr::new(&s.interface))
                    };
                    if iface_missing {
                        networks.refresh(true);
                    }

                    let (dl, ul, elapsed_ms, iface, was_uninitialized) = {
                        let mut s = monitor_state.lock();
                        let uninit = s.last_sample.is_none();
                        tick_sample_with_networks(&mut s, networks, now_ts);
                        (
                            s.last_download,
                            s.last_upload,
                            s.last_elapsed_ms,
                            s.interface.clone(),
                            uninit,
                        )
                    };

                    if !iface.is_empty() && !was_uninitialized {
                        {
                            let conn = db.0.lock();
                            if let Err(e) = insert_sample(&conn, now_ts, &iface, dl, ul, elapsed_ms) {
                                tracing::warn!("Failed to store sample: {e}");
                            }
                        }

                        if any_window_visible(&app_handle) {
                            let _ = app_handle.emit(
                                "network-stats",
                                &crate::dto::network::NetworkStatsEvent {
                                    upload_bps: ul,
                                    download_bps: dl,
                                    interface_name: iface,
                                },
                            );
                        }
                    }

                    // Periodic ping (every 5 seconds), off the sampling path
                    if tick_counter.is_multiple_of(PING_INTERVAL_TICKS) {
                        spawn_ping(&app_handle, &ping_state, &ping_in_flight);
                    }

                    // Roll up whenever the local hour changes (also covers
                    // day/month changes and wake from sleep).
                    let current_hour_start = hour_start(&Local, now_ts);
                    if last_hour_start.is_some_and(|prev| prev != current_hour_start) {
                        run_catch_up(&db);
                    }
                    last_hour_start = Some(current_hour_start);
                }

                _ = daily_snapshot_interval.tick() => {
                    // Keep today's daily_usage row live for the History page
                    let conn = db.0.lock();
                    if let Err(e) = refresh_today(&conn, &Local, Local::now().timestamp()) {
                        tracing::warn!("Daily snapshot failed: {e}");
                    }
                }

                _ = cleanup_interval.tick() => {
                    let cutoff = Local::now().timestamp() - 7 * 86_400;
                    let conn = db.0.lock();

                    if let Err(e) = cleanup_old_samples(&conn, cutoff) {
                        tracing::warn!("Cleanup failed: {e}");
                    }

                    // FIX: Periodic WAL checkpoint so SQLite doesn't accumulate
                    // un-checkpointed pages in shared memory indefinitely.
                    // PASSIVE mode: checkpoints without blocking readers/writers.
                    // Without this, insert_sample (2/s) + rollup_daily_at (every 10s)
                    // fills the WAL continuously, growing SQLite's mapped memory footprint.
                    let _ = conn.execute("PRAGMA wal_checkpoint(PASSIVE)", []);
                }
            }
        }
    });

    Arc::new(Mutex::new(Some(handle)))
}
