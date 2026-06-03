use crate::commands::network::{tick_sample, SharedMonitorState};
use crate::storage::aggregation::{rollup_daily, rollup_hourly, rollup_monthly};
use crate::storage::repository::{cleanup_old_samples, insert_sample};
use crate::storage::DbState;

pub fn start_sampler(
    state_for_task: SharedMonitorState,
    bg_db: DbState,
) { 
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));

        // Housekeeping timers
        let mut last_cleanup = tokio::time::Instant::now();
        let cleanup_interval = std::time::Duration::from_secs(60);

        // Track hour/day changes to trigger rollups exactly once.
        let mut last_hour: Option<u32> = None;
        let mut last_day: Option<u32> = None;

        loop {
            interval.tick().await;

            // ── 1. Tick the network sampler ───────────────────────
            let (dl_bps, ul_bps, iface) = {
                let mut s = state_for_task.lock().unwrap();
                tick_sample(&mut s);
                (s.last_download, s.last_upload, s.interface.clone())
            };

            // ── 2. Write raw sample to SQLite ─────────────────────
            // Skip the initial priming tick where both values are 0.0
            // and the interface may not be selected yet.
            if !iface.is_empty() && (dl_bps > 0.0 || ul_bps > 0.0) {
                let now_ts = chrono::Local::now().timestamp();
                if let Ok(conn) = bg_db.0.lock() {
                    let _ = insert_sample(&conn, now_ts, &iface, dl_bps, ul_bps);
                }
            }

            // ── 3. Cleanup old raw samples (every 60 s) ───────────
            if last_cleanup.elapsed() >= cleanup_interval {
                let cutoff = chrono::Local::now().timestamp() - 7 * 86_400;
                if let Ok(conn) = bg_db.0.lock() {
                    let _ = cleanup_old_samples(&conn, cutoff);
                }
                last_cleanup = tokio::time::Instant::now();
            }

            // ── 4. Hourly rollup — fires once when the hour turns ─
            // NOTE: This must run before the daily rollup at midnight.
            // The daily rollup depends on the 23:00–00:00 hour being
            // present in hourly_usage, which is created here.
            let now_local = chrono::Local::now();
            let current_hour = chrono::Timelike::hour(&now_local);
            let current_day = chrono::Datelike::day(&now_local);

            if let Some(prev_hour) = last_hour {
                if prev_hour != current_hour {
                    // The hour just changed — roll up the completed hour.
                    if let Ok(conn) = bg_db.0.lock() {
                        let _ = rollup_hourly(&conn);
                    }
                }
            }
            last_hour = Some(current_hour);

            // ── 5. Daily rollup — fires once when the day turns ───
            // Keep this block after the hourly rollup to avoid dropping
            // the final hour of the previous day.
            if let Some(prev_day) = last_day {
                if prev_day != current_day {
                    // The day just changed — roll up yesterday.
                    if let Ok(conn) = bg_db.0.lock() {
                        let _ = rollup_daily(&conn);

                        // On the 1st of a new month, also roll up last month.
                        if current_day == 1 {
                            let _ = rollup_monthly(&conn);
                        }
                    }
                }
            }
            last_day = Some(current_day);
        }
    });
}