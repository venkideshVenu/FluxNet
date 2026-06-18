use crate::commands::network::{
    SharedMonitorState, select_interface_outside_lock, tick_sample_with_networks,
};
use crate::commands::ping::SharedPingState;
use crate::monitor::ping::measure_ping;
use crate::persistence::app_settings::SettingsStore;
use crate::storage::DbState;
use crate::storage::aggregation::{
    rollup_daily, rollup_daily_at, rollup_hourly, rollup_hourly_at, rollup_monthly,
    rollup_monthly_for,
};
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use chrono::{Datelike, Duration as ChronoDuration, Local, TimeZone, Timelike};
use parking_lot::Mutex;
use std::collections::HashSet;
use std::net::{IpAddr, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::Networks;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

/// Fixed backend sampling interval — always 500ms for accurate measurements.
const SAMPLER_INTERVAL_MS: u64 = 500;

const PING_INTERVAL_TICKS: u32 = 10; // 10 × 500ms = 5s

pub type SamplerHandle = Arc<Mutex<Option<JoinHandle<()>>>>;

/// Resolve a ping target string to an IpAddr.
/// Supports raw IP addresses and hostnames.
fn resolve_ping_target(target: &str) -> IpAddr {
    // Try direct IP parse first
    if let Ok(ip) = target.parse::<IpAddr>() {
        return ip;
    }
    // Try DNS resolution
    if let Ok(mut addrs) = format!("{}:0", target).to_socket_addrs() {
        if let Some(addr) = addrs.next() {
            return addr.ip();
        }
    }
    // Fallback
    "1.1.1.1".parse().unwrap()
}

// ── Startup backfill: compute all missing rollups ─────────────────────────────

fn backfill_all_rollups(db: &DbState) {
    let conn = db.0.lock();

    let now = Local::now();
    let current_hour_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), now.hour(), 0, 0)
        .unwrap()
        .timestamp();

    let earliest_ts: Option<i64> = conn
        .query_row("SELECT MIN(timestamp) FROM bandwidth_samples", [], |r| {
            r.get(0)
        })
        .ok()
        .flatten();

    let Some(earliest_ts) = earliest_ts else {
        tracing::debug!("No samples in DB — skipping backfill");
        return;
    };

    let existing_hours: HashSet<i64> = {
        let mut stmt = conn.prepare("SELECT hour_start FROM hourly_usage").unwrap();
        stmt.query_map([], |r| r.get::<_, i64>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let earliest_local = Local.timestamp_opt(earliest_ts, 0).single().unwrap_or(now);
    let mut hour_cursor = Local
        .with_ymd_and_hms(
            earliest_local.year(),
            earliest_local.month(),
            earliest_local.day(),
            earliest_local.hour(),
            0,
            0,
        )
        .unwrap()
        .timestamp();

    let mut hourly_count = 0u32;

    while hour_cursor < current_hour_start {
        if !existing_hours.contains(&hour_cursor) {
            let has_samples: bool = conn
                .query_row(
                    "SELECT 1 FROM bandwidth_samples WHERE timestamp >= ?1 AND timestamp < ?2 LIMIT 1",
                    [hour_cursor, hour_cursor + 3600],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if has_samples {
                if rollup_hourly_at(&conn, hour_cursor).is_ok() {
                    hourly_count += 1;
                }
            }
        }
        hour_cursor += 3600;
    }

    if hourly_count > 0 {
        tracing::info!("Backfilled {hourly_count} hourly rollup(s)");
    }

    let today_str = now.format("%Y-%m-%d").to_string();
    let today_start = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 0, 0, 0)
        .unwrap()
        .timestamp();

    let existing_days: HashSet<String> = {
        let mut stmt = conn.prepare("SELECT day FROM daily_usage").unwrap();
        stmt.query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let earliest_day_start = Local
        .with_ymd_and_hms(
            earliest_local.year(),
            earliest_local.month(),
            earliest_local.day(),
            0,
            0,
            0,
        )
        .unwrap();

    let mut day_cursor = earliest_day_start;
    let mut daily_count = 0u32;

    while day_cursor.timestamp() < today_start {
        let day_str = day_cursor.format("%Y-%m-%d").to_string();

        if !existing_days.contains(&day_str) {
            let day_ts = day_cursor.timestamp();
            let has_data: bool = conn
                .query_row(
                    "SELECT 1 FROM bandwidth_samples WHERE timestamp >= ?1 AND timestamp < ?2 LIMIT 1",
                    [day_ts, day_ts + 86_400],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if has_data {
                if rollup_daily_at(&conn, day_ts, &day_str).is_ok() {
                    daily_count += 1;
                }
            }
        }

        day_cursor = day_cursor + ChronoDuration::days(1);
    }

    if daily_count > 0 {
        tracing::info!("Backfilled {daily_count} daily rollup(s)");
    }

    let current_month_str = now.format("%Y-%m").to_string();

    let months_with_data: HashSet<String> = {
        let mut stmt = conn
            .prepare("SELECT DISTINCT SUBSTR(day, 1, 7) FROM daily_usage")
            .unwrap();
        stmt.query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let existing_months: HashSet<String> = {
        let mut stmt = conn.prepare("SELECT month FROM monthly_usage").unwrap();
        stmt.query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let mut monthly_count = 0u32;
    for month in &months_with_data {
        if month < &current_month_str && !existing_months.contains(month) {
            if rollup_monthly_for(&conn, month).is_ok() {
                monthly_count += 1;
            }
        }
    }

    if monthly_count > 0 {
        tracing::info!("Backfilled {monthly_count} monthly rollup(s)");
    }

    {
        let has_today_samples: bool = conn
            .query_row(
                "SELECT 1 FROM bandwidth_samples WHERE timestamp >= ?1 AND timestamp < ?2 LIMIT 1",
                [today_start, today_start + 86_400],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if has_today_samples {
            let _ = rollup_daily_at(&conn, today_start, &today_str);
            tracing::debug!("Updated today's partial daily_usage snapshot");
        }
    }
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
    settings_store: Arc<SettingsStore>,
    app_handle: AppHandle,
) -> SamplerHandle {
    let handle: JoinHandle<()> = tauri::async_runtime::spawn(async move {
        // Run backfill on a blocking thread so we don't block the async runtime
        {
            let db_clone = db.clone();
            let _ = tokio::task::spawn_blocking(move || {
                backfill_all_rollups(&db_clone);
            })
            .await;
        }

        let mut sample_interval = tokio::time::interval(Duration::from_millis(SAMPLER_INTERVAL_MS));
        sample_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut cleanup_interval = tokio::time::interval(Duration::from_secs(60));
        cleanup_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut daily_snapshot_interval = tokio::time::interval(Duration::from_secs(10));
        daily_snapshot_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut tick_counter = 0u32;
        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        let mut networks = Networks::new_with_refreshed_list();

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("Sampler shutting down – performing final WAL checkpoint");
                    let db_clone = db.clone();
                    let _ = tokio::task::spawn_blocking(move || {
                        let conn = db_clone.0.lock();
                        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    }).await;
                    break;
                }

                _ = sample_interval.tick() => {
                    tick_counter = tick_counter.wrapping_add(1);

                    let now_local = Local::now();
                    let now_ts = now_local.timestamp();
                    let current_hour = now_local.hour();
                    let current_day = now_local.day();

                    // Refresh network list every 10 ticks (5s) to detect hot-plugged interfaces
                    // Regular refresh only updates counters for known interfaces
                    if tick_counter % 10 == 0 {
                        networks = Networks::new_with_refreshed_list();
                    } else {
                        networks.refresh();
                    }

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

                    // Also verify current interface still exists in sysinfo
                    let iface_missing = {
                        let s = monitor_state.lock();
                        if !s.interface.is_empty() {
                            !networks.iter().any(|(n, _)| n == &s.interface)
                        } else {
                            false
                        }
                    };
                    if iface_missing && tick_counter % 10 == 0 {
                        // Force a full list refresh when interface is missing
                        networks = Networks::new_with_refreshed_list();
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
                        let target = resolve_ping_target(&target_str);
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

                    // Rollups at time boundaries
                    let hour_changed =
                        last_hour.map_or(false, |prev| prev != current_hour);
                    let day_changed =
                        last_day.map_or(false, |prev| prev != current_day);

                    if hour_changed || day_changed {
                        let conn = db.0.lock();
                        let _ = conn.execute("BEGIN IMMEDIATE", []);

                        if hour_changed {
                            if let Err(e) = rollup_hourly(&conn, now_local) {
                                tracing::warn!("Hourly rollup failed: {e}");
                            }
                        }

                        if day_changed {
                            let yesterday = now_local - ChronoDuration::days(1);
                            if let Err(e) = rollup_daily(&conn, yesterday) {
                                tracing::warn!("Daily rollup failed: {e}");
                            }

                            if current_day == 1 {
                                if let Err(e) = rollup_monthly(&conn, now_local) {
                                    tracing::warn!("Monthly rollup failed: {e}");
                                }
                            }
                        }

                        let _ = conn.execute("COMMIT", []);
                    }

                    last_hour = Some(current_hour);
                    last_day = Some(current_day);
                }

                _ = daily_snapshot_interval.tick() => {
                    let now_local = Local::now();
                    let today_str = now_local.format("%Y-%m-%d").to_string();
                    let today_start = Local
                        .with_ymd_and_hms(
                            now_local.year(),
                            now_local.month(),
                            now_local.day(),
                            0, 0, 0,
                        )
                        .unwrap()
                        .timestamp();

                    let conn = db.0.lock();
                    let _ = rollup_daily_at(&conn, today_start, &today_str);
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
