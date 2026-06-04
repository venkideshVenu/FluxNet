use chrono::{Datelike, Timelike};
use tokio_util::sync::CancellationToken;
use crate::commands::network::SharedMonitorState;
use crate::storage::DbState;
use crate::storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use crate::storage::repository::{cleanup_old_samples, insert_sample};

pub fn start_sampler(
    state_for_task: SharedMonitorState,
    bg_db: DbState,
    cancel_token: CancellationToken,
) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        let mut last_cleanup = tokio::time::Instant::now();
        let cleanup_interval = std::time::Duration::from_secs(60);
        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    // Graceful shutdown: final checkpoint and close
                    tracing::info!("Sampler task received shutdown signal");
                    if let Ok(conn) = bg_db.0.lock() {
                        let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE)", []);
                    }
                    break;
                }
                _ = interval.tick() => {
                    // ── Normal sampling work ──────────────────────
                    let (dl_bps, ul_bps, iface) = {
                        let mut s = state_for_task.lock().unwrap();
                        crate::commands::network::tick_sample(&mut s);
                        (s.last_download, s.last_upload, s.interface.clone())
                    };

                    if !iface.is_empty() && (dl_bps > 0.0 || ul_bps > 0.0) {
                        let now_ts = chrono::Local::now().timestamp();
                        if let Ok(conn) = bg_db.0.lock() {
                            let _ = insert_sample(&conn, now_ts, &iface, dl_bps, ul_bps);
                        }
                    }

                    // Cleanup old samples every 60s
                    if last_cleanup.elapsed() >= cleanup_interval {
                        let cutoff = chrono::Local::now().timestamp() - 7 * 86_400;
                        if let Ok(conn) = bg_db.0.lock() {
                            let _ = cleanup_old_samples(&conn, cutoff);
                        }
                        last_cleanup = tokio::time::Instant::now();
                    }

                    // Hourly rollup
                    let now_local = chrono::Local::now();
                    let current_hour = now_local.hour();
                    let current_day = now_local.day();

                    if let Some(prev_hour) = last_hour {
                        if prev_hour != current_hour {
                            if let Ok(conn) = bg_db.0.lock() {
                                let _ = rollup_hourly(&conn);
                            }
                        }
                    }
                    last_hour = Some(current_hour);

                    // Daily rollup (and monthly on 1st)
                    if let Some(prev_day) = last_day {
                        if prev_day != current_day {
                            if let Ok(conn) = bg_db.0.lock() {
                                let _ = rollup_daily(&conn);
                                if current_day == 1 {
                                    let _ = rollup_monthly(&conn);
                                }
                            }
                        }
                    }
                    last_day = Some(current_day);
                }
            }
        }
    });
}