use serde::{Deserialize, Serialize};
use sysinfo::{Networks, System};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkStats {
    pub upload_bytes_per_sec: f64,
    pub download_bytes_per_sec: f64,
    pub interface_name: String,
}

/// Pure calculation — takes raw byte counters and a time delta, returns speed.
/// This is the function we test in isolation.
pub fn calculate_speed(current_bytes: u64, previous_bytes: u64, elapsed_secs: f64) -> f64 {
    if elapsed_secs <= 0.0 {
        return 0.0;
    }
    // Counter reset guard: if current < previous, interface was reset
    if current_bytes < previous_bytes {
        return 0.0;
    }
    (current_bytes - previous_bytes) as f64 / elapsed_secs
}

/// Reads current byte counters from the OS for a specific interface.
pub fn read_interface_counters(interface_name: &str) -> Option<(u64, u64)> {
    let networks = Networks::new_with_refreshed_list();
    for (name, data) in &networks {
        if name == interface_name {
            return Some((data.transmitted(), data.received()));
        }
    }
    None
}

/// Lists all available network interface names.
pub fn list_interfaces() -> Vec<String> {
    let networks = Networks::new_with_refreshed_list();
    networks.iter().map(|(name, _)| name.clone()).collect()
}

// ─── TESTS ───────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_speed_basic_calculation() {
        // 1 MB transferred in 1 second = 1 MB/s
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
        // If current < previous, the counter reset (interface reconnected)
        let speed = calculate_speed(100, 1_000_000, 1.0);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_handles_zero_elapsed() {
        // Guard against division by zero
        let speed = calculate_speed(2_000_000, 1_000_000, 0.0);
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_speed_with_sub_second_interval() {
        // 500KB transferred in 0.5s = 1 MB/s
        let speed = calculate_speed(1_500_000, 1_000_000, 0.5);
        assert_eq!(speed, 1_000_000.0);
    }

    #[test]
    fn test_list_interfaces_returns_something() {
        // On any real machine there should be at least one interface
        let interfaces = list_interfaces();
        assert!(!interfaces.is_empty(), "expected at least one network interface");
    }
}