use crate::commands::network::{tick_sample, SharedMonitorState};
use crate::commands::ping::SharedPingState;
use crate::monitor::ping::measure_ping;
use crate::storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use crate::storage::DbState;
use chrono::{Datelike, Local, Timelike};
use std::net::IpAddr;
use tokio_util::sync::CancellationToken;

const PING_TARGET: &str = "1.1.1.1";
const PING_INTERVAL_TICKS: u32 = 10; // 10 * 500 ms = 5 seconds

pub fn start_sampler(
    monitor_state: SharedMonitorState,
    db: DbState,
    ping_state: SharedPingState,
    cancel_token: CancellationToken,
) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        let mut tick_counter = 0u32;
        let target: IpAddr = PING_TARGET.parse().expect("invalid ping target");

        let mut last_cleanup = tokio::time::Instant::now();
        let cleanup_interval = std::time::Duration::from_secs(60);

        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("Sampler shutting down – performing final checkpoint");
                    let conn = db.0.lock();
                    let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    break;
                }
                _ = interval.tick() => {
                    tick_counter = tick_counter.wrapping_add(1);

                    // ---- Network sampling (every 500 ms) ----
                    let (dl, ul, iface) = {
                        let mut s = monitor_state.lock();
                        tick_sample(&mut s);
                        (s.last_download, s.last_upload, s.interface.clone())
                    };
                    if !iface.is_empty() && (dl > 0.0 || ul > 0.0) {
                        let now_ts = Local::now().timestamp();
                        let conn = db.0.lock();
                        let _ = insert_sample(&conn, now_ts, &iface, dl, ul);
                    }

                    // ---- Periodic ping (every 5 seconds) ----
                    if tick_counter % PING_INTERVAL_TICKS == 0 {
                        let result = measure_ping(target).await;
                        let mut ps = ping_state.lock();
                        ps.update(result.latency_ms, result.loss);
                    }

                    // ---- Cleanup old raw samples (every 60 s) ----
                    if last_cleanup.elapsed() >= cleanup_interval {
                        let cutoff = Local::now().timestamp() - 7 * 86_400;
                        let conn = db.0.lock();
                        let _ = cleanup_old_samples(&conn, cutoff);
                        last_cleanup = tokio::time::Instant::now();
                    }

                    // ---- Rollups (hourly, daily, monthly) in a single transaction ----
                    let now_local = Local::now();
                    let current_hour = now_local.hour();
                    let current_day = now_local.day();

                    let hour_changed = last_hour.map_or(false, |prev| prev != current_hour);
                    let day_changed = last_day.map_or(false, |prev| prev != current_day);

                    if hour_changed || day_changed {
                        let conn = db.0.lock();
                        // Start a transaction to ensure atomicity
                        let _ = conn.execute("BEGIN IMMEDIATE", []);
                        if hour_changed {
                            let _ = rollup_hourly(&conn);
                        }
                        if day_changed {
                            let _ = rollup_daily(&conn);
                            // On the 1st of a new month, also roll up last month
                            if current_day == 1 {
                                let _ = rollup_monthly(&conn);
                            }
                        }
                        let _ = conn.execute("COMMIT", []);
                    }

                    last_hour = Some(current_hour);
                    last_day = Some(current_day);
                }
            }
        }
    });
}
