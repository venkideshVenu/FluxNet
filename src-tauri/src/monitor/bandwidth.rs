use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use sysinfo::Networks;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkStats {
    pub upload_bytes_per_sec: f64,
    pub download_bytes_per_sec: f64,
    pub interface_name: String,
}

pub fn calculate_speed(current_bytes: u64, previous_bytes: u64, elapsed_secs: f64) -> f64 {
    // Guard: ignore impossibly short intervals (scheduler jitter / back-to-back ticks)
    if elapsed_secs < 0.01 {
        return 0.0;
    }
    // Guard: backward jump means counter reset or interface switch — emit 0, not a spike
    if current_bytes < previous_bytes {
        return 0.0;
    }
    (current_bytes - previous_bytes) as f64 / elapsed_secs
}

/// Loads the adapter list with fresh counters. `None` if the OS won't
/// enumerate adapters (sysinfo reports this as an error; Windows never does).
pub fn load_networks() -> Option<Networks> {
    match Networks::new_with_refreshed_list() {
        Ok(networks) => Some(networks),
        Err(e) => {
            tracing::warn!("Couldn't list network adapters: {e}");
            None
        }
    }
}

pub fn read_total_counters(networks: &Networks, interface_name: &str) -> Option<(u64, u64)> {
    // total_transmitted / total_received = cumulative since boot
    networks
        .get(OsStr::new(interface_name))
        .map(|data| (data.total_transmitted(), data.total_received()))
}

// ─── TESTS ───────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counters_are_found_by_name_for_every_listed_adapter() {
        let networks = load_networks().expect("adapter list");
        for name in networks.keys() {
            let Some(name) = name.to_str() else { continue };
            assert!(read_total_counters(&networks, name).is_some(), "{name}");
        }
        assert_eq!(read_total_counters(&networks, "no-such-adapter"), None);
    }

    #[test]
    fn test_speed_basic_calculation() {
        let speed = calculate_speed(2_000_000, 1_000_000, 1.0);
        assert_eq!(speed, 1_000_000.0);
    }

    #[test]
    fn test_speed_is_zero_when_no_change() {
        let speed = calculate_speed(1_000_000, 1_000_000, 1.0);
        assert_eq!(speed, 0.0);
    }

    /// FIX R1: Counter reset (current < previous) must yield 0, not a gigabit spike.
    #[test]
    fn test_speed_handles_counter_reset() {
        let speed = calculate_speed(100, 1_000_000, 1.0);
        assert_eq!(speed, 0.0); // was incorrectly non-zero before fix
    }

    #[test]
    fn test_speed_handles_zero_elapsed() {
        let speed = calculate_speed(2_000_000, 1_000_000, 0.0);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_handles_sub_10ms_elapsed() {
        // Sub-10 ms ticks should be suppressed to avoid divide-by-tiny spikes
        let speed = calculate_speed(2_000_000, 1_000_000, 0.005);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_with_sub_second_interval() {
        let speed = calculate_speed(1_500_000, 1_000_000, 0.5);
        assert_eq!(speed, 1_000_000.0);
    }

    #[test]
    fn test_speed_handles_backward_jump_as_reset() {
        // Simulate: previous ≈ u32::MAX, current tiny — treated as reset
        let prev = (u32::MAX as u64) - 100;
        let curr = 200u64;
        let speed = calculate_speed(curr, prev, 1.0);
        assert_eq!(speed, 0.0); // reset, not a wrap spike
    }
}
