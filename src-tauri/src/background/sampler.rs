use crate::commands::network::{
    select_interface_outside_lock, tick_sample_with_networks, SharedMonitorState,
};
use crate::commands::ping::SharedPingState;
use crate::monitor::ping::measure_ping;
use crate::persistence::app_settings::SettingsStore;
use crate::storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use crate::storage::DbState;
use chrono::{Datelike, Duration as ChronoDuration, Local, Timelike};
use parking_lot::Mutex;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::Networks;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

/// Fixed backend sampling interval — always 500ms for accurate measurements.
/// Frontend display refresh is controlled independently per window.
const SAMPLER_INTERVAL_MS: u64 = 500;

const PING_INTERVAL_TICKS: u32 = 10; // 10 × 500ms = 5s

pub type SamplerHandle = Arc<Mutex<Option<JoinHandle<()>>>>;

// ── Startup catch-up: fill missing monthly rows ──────────────────────────────

fn backfill_missing_months(db: &DbState) {
    let conn = db.0.lock();
    let now = Local::now();
    let current_month_str = now.format("%Y-%m").to_string();

    let last_stored: Option<String> = conn
        .query_row(
            "SELECT month FROM monthly_usage ORDER BY month DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .ok();

    let Some(last_str) = last_stored else {
        return;
    };
    if last_str >= current_month_str {
        return;
    }

    tracing::info!("Back-filling monthly rollups from {last_str} to {current_month_str}");

    let mut cursor: chrono::NaiveDate = {
        let parts: Vec<&str> = last_str.splitn(2, '-').collect();
        let y: i32 = parts[0].parse().unwrap_or(now.year());
        let m: u32 = parts[1].parse().unwrap_or(now.month());
        let next_m = if m == 12 { 1 } else { m + 1 };
        let next_y = if m == 12 { y + 1 } else { y };
        chrono::NaiveDate::from_ymd_opt(next_y, next_m, 1).unwrap_or_default()
    };

    while cursor.format("%Y-%m").to_string() < current_month_str {
        let dt = cursor
            .and_hms_opt(0, 0, 0)
            .and_then(|dt| dt.and_local_timezone(Local).single())
            .unwrap_or_else(Local::now);
        let _ = rollup_monthly(&conn, dt);

        let m = cursor.month();
        let y = cursor.year();
        let next_m = if m == 12 { 1 } else { m + 1 };
        let next_y = if m == 12 { y + 1 } else { y };
        if let Some(nd) = chrono::NaiveDate::from_ymd_opt(next_y, next_m, 1) {
            cursor = nd;
        } else {
            break;
        }
    }
}

fn any_window_visible(app: &AppHandle) -> bool {
    app.webview_windows()
        .values()
        .any(|w| w.is_visible().unwrap_or(false))
}

/// Starts the background sampling loop at a fixed 500ms rate.
pub fn start_sampler(
    monitor_state: SharedMonitorState,
    db: DbState,
    ping_state: SharedPingState,
    cancel_token: CancellationToken,
    settings_store: Arc<SettingsStore>,
    app_handle: AppHandle,
) -> SamplerHandle {
    backfill_missing_months(&db);

    let handle: JoinHandle<()> = tauri::async_runtime::spawn(async move {
        let mut sample_interval = tokio::time::interval(Duration::from_millis(SAMPLER_INTERVAL_MS));
        sample_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut cleanup_interval = tokio::time::interval(Duration::from_secs(60));
        cleanup_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut tick_counter = 0u32;
        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        let mut networks = Networks::new_with_refreshed_list();

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("Sampler shutting down – performing final WAL checkpoint");
                    let db_clone = db.clone();
                    std::thread::spawn(move || {
                        let conn = db_clone.0.lock();
                        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    });
                    break;
                }

                _ = sample_interval.tick() => {
                    tick_counter = tick_counter.wrapping_add(1);

                    let now_local = Local::now();
                    let now_ts = now_local.timestamp();
                    let current_hour = now_local.hour();
                    let current_day = now_local.day();

                    networks.refresh();

                    let needs_selection = {
                        let s = monitor_state.lock();
                        s.interface.is_empty()
                    };
                    if needs_selection {
                        let selected = select_interface_outside_lock(&networks);
                        if !selected.is_empty() {
                            let mut s = monitor_state.lock();
                            if s.interface.is_empty() {
                                s.interface = selected;
                            }
                        }
                    }

                    let (dl, ul, iface, was_uninitialized) = {
                        let mut s = monitor_state.lock();
                        let uninit = s.last_sample.is_none();
                        tick_sample_with_networks(&mut s, &networks, now_ts);
                        (s.last_download, s.last_upload, s.interface.clone(), uninit)
                    };

                    if !iface.is_empty() && !was_uninitialized {
                        {
                            let conn = db.0.lock();
                            let _ = insert_sample(&conn, now_ts, &iface, dl, ul);
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

                    // Periodic ping
                    if tick_counter % PING_INTERVAL_TICKS == 0 {
                        let target_str = settings_store.read(|s| s.ping_target.clone());
                        let target: IpAddr = target_str
                            .parse()
                            .unwrap_or_else(|_| "1.1.1.1".parse().unwrap());
                        let result = measure_ping(target).await;
                        let stats = {
                            let mut ps = ping_state.lock();
                            ps.update(result.latency_ms, result.loss);
                            ps.current_stats()
                        };
                        if any_window_visible(&app_handle) {
                            let _ = app_handle.emit("ping-stats", &stats);
                        }
                    }

                    // Rollups
                    let hour_changed =
                        last_hour.map_or(false, |prev| prev != current_hour);
                    let day_changed =
                        last_day.map_or(false, |prev| prev != current_day);

                    if hour_changed || day_changed {
                        let conn = db.0.lock();
                        let _ = conn.execute("BEGIN IMMEDIATE", []);

                        if hour_changed {
                            let _ = rollup_hourly(&conn, now_local);
                        }

                        if day_changed {
                            let yesterday = now_local - ChronoDuration::days(1);
                            let _ = rollup_daily(&conn, yesterday);

                            if current_day == 1 {
                                let _ = rollup_monthly(&conn, now_local);
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

    Arc::new(Mutex::new(Some(handle)))
}
