use crate::commands::network::{tick_sample_with_networks, SharedMonitorState};
use crate::commands::ping::SharedPingState;
use crate::monitor::ping::measure_ping;
use crate::persistence::app_settings::SettingsStore;
use crate::storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use crate::storage::DbState;
use chrono::{Datelike, Local, Timelike};
use std::net::IpAddr;
use std::sync::Arc;
use sysinfo::Networks;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

const PING_INTERVAL_TICKS: u32 = 10; // 10 * 500 ms = 5 seconds

pub fn start_sampler(
    monitor_state: SharedMonitorState,
    db: DbState,
    ping_state: SharedPingState,
    cancel_token: CancellationToken,
    settings_store: Arc<SettingsStore>,
    app_handle: AppHandle,  // needed to read settings
) {
    tauri::async_runtime::spawn(async move {
        let mut sample_interval = tokio::time::interval(std::time::Duration::from_millis(500));
        let mut cleanup_interval = tokio::time::interval(std::time::Duration::from_secs(60));
        cleanup_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut tick_counter = 0u32;
        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        // Create a Networks instance that we'll reuse and refresh each tick
        let mut networks = Networks::new_with_refreshed_list();

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("Sampler shutting down – performing final checkpoint");
                    let conn = db.0.lock();
                    let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    break;
                }
                _ = sample_interval.tick() => {
                    tick_counter = tick_counter.wrapping_add(1);

                    // ---- Refresh network counters outside the lock ----
                    networks.refresh();

                    // ---- Network sampling (every 500 ms) ----
                    let (dl, ul, iface, is_priming) = {
                        let mut s = monitor_state.lock();
                        let was_priming = s.last_sample.is_none();
                        tick_sample_with_networks(&mut s, &networks);
                        (s.last_download, s.last_upload, s.interface.clone(), was_priming)
                    };
                    if !iface.is_empty() && !is_priming {
                        let now_ts = Local::now().timestamp();
                        let conn = db.0.lock();
                        let _ = insert_sample(&conn, now_ts, &iface, dl, ul);
                    }

                    // ---- Periodic ping (every 5 seconds) with configurable target ----
                    if tick_counter % PING_INTERVAL_TICKS == 0 {
                        let target_str = settings_store.read(|s| s.ping_target.clone());
                        let target: IpAddr = target_str.parse().unwrap_or_else(|_| "1.1.1.1".parse().unwrap());
                        let result = measure_ping(target).await;
                        let mut ps = ping_state.lock();
                        ps.update(result.latency_ms, result.loss);
                    }

                    // ---- Rollups (unchanged) ----
                    let now_local = Local::now();
                    let current_hour = now_local.hour();
                    let current_day = now_local.day();

                    let hour_changed = last_hour.map_or(false, |prev| prev != current_hour);
                    let day_changed = last_day.map_or(false, |prev| prev != current_day);

                    if hour_changed || day_changed {
                        let conn = db.0.lock();
                        let _ = conn.execute("BEGIN IMMEDIATE", []);
                        if hour_changed {
                            let _ = rollup_hourly(&conn);
                        }
                        if day_changed {
                            let _ = rollup_daily(&conn);
                            if current_day == 1 {
                                let _ = rollup_monthly(&conn);
                            }
                        }
                        let _ = conn.execute("COMMIT", []);
                    }

                    last_hour = Some(current_hour);
                    last_day = Some(current_day);
                }
                _ = cleanup_interval.tick() => {
                    let cutoff = Local::now().timestamp() - 7 * 86_400;
                    let conn = db.0.lock();
                    if let Err(e) = cleanup_old_samples(&conn, cutoff) {
                        tracing::warn!("Cleanup failed: {e}");
                    }
                }
            }
        }
    });
}