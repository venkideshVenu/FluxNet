use serde::{Deserialize, Serialize};
use sysinfo::Networks;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkStats {
    pub upload_bytes_per_sec: f64,
    pub download_bytes_per_sec: f64,
    pub interface_name: String,
}

/// Pure calculation — takes raw byte counters and a time delta, returns speed.
/// Handles 32‑bit counter wrap (e.g., adapters that wrap at 4 GiB).
pub fn calculate_speed(current_bytes: u64, previous_bytes: u64, elapsed_secs: f64) -> f64 {
    if elapsed_secs <= 0.0 {
        return 0.0;
    }
    let delta = if current_bytes >= previous_bytes {
        current_bytes - previous_bytes
    } else {
        // 32-bit counter wrap: u32::MAX - previous + current + 1
        (u32::MAX as u64)
            .wrapping_add(1)
            .wrapping_add(current_bytes)
            .wrapping_sub(previous_bytes)
    };
    delta as f64 / elapsed_secs
}

/// Returns total cumulative bytes (tx, rx) for an interface
/// from a ALREADY-REFRESHED Networks object.
/// Caller is responsible for calling networks.refresh() before this.
pub fn read_total_counters(networks: &Networks, interface_name: &str) -> Option<(u64, u64)> {
    for (name, data) in networks {
        if name == interface_name {
            // total_transmitted / total_received = cumulative since boot
            // These are stable across object recreation — perfect for our delta.
            return Some((data.total_transmitted(), data.total_received()));
        }
    }
    None
}

/// Lists all available network interface names from a refreshed Networks object.
pub fn list_interfaces(networks: &Networks) -> Vec<String> {
    networks.iter().map(|(name, _)| name.clone()).collect()
}

// ─── TESTS ───────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn test_speed_handles_counter_reset() {
        let speed = calculate_speed(100, 1_000_000, 1.0);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_handles_zero_elapsed() {
        let speed = calculate_speed(2_000_000, 1_000_000, 0.0);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_with_sub_second_interval() {
        let speed = calculate_speed(1_500_000, 1_000_000, 0.5);
        assert_eq!(speed, 1_000_000.0);
    }

    #[test]
    fn test_list_interfaces_returns_something() {
        let networks = Networks::new_with_refreshed_list();
        let interfaces = list_interfaces(&networks);
        assert!(
            !interfaces.is_empty(),
            "expected at least one network interface"
        );
    }

    #[test]
    fn test_speed_handles_32bit_counter_wrap() {
        // Simulate wrap: previous = u32::MAX - 100, current = 200
        let prev = (u32::MAX as u64) - 100;
        let curr = 200u64;
        let elapsed = 1.0;
        let speed = calculate_speed(curr, prev, elapsed);
        // Delta should be (u32::MAX - prev) + curr + 1 = 100 + 200 + 1 = 301 bytes
        assert_eq!(speed, 301.0);
    }
}
