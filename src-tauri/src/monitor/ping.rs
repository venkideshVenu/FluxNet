use std::net::IpAddr;
use std::time::Duration;
use surge_ping::{Client, Config, PingIdentifier, PingSequence};
use tokio::time::timeout;

pub struct PingResult {
    pub latency_ms: Option<f64>, // None = timeout / unreachable
    pub loss: bool,              // true = this packet was lost
}

/// Sends a single ICMP echo to the target and returns the RTT.
/// Times out after 2 seconds — treated as packet loss.
pub async fn measure_ping(target: IpAddr) -> PingResult {
    let config = Config::builder().build();
    let client = match Client::new(&config) {
        Ok(c) => c,
        Err(_) => {
            return PingResult {
                latency_ms: None,
                loss: true,
            }
        }
    };

    let payload = [0u8; 8];
    let mut pinger = client.pinger(target, PingIdentifier(rand_id())).await;
    pinger.timeout(Duration::from_secs(2));

    match timeout(
        Duration::from_secs(2),
        pinger.ping(PingSequence(0), &payload),
    )
    .await
    {
        Ok(Ok((_, dur))) => PingResult {
            latency_ms: Some(dur.as_secs_f64() * 1000.0),
            loss: false,
        },
        _ => PingResult {
            latency_ms: None,
            loss: true,
        },
    }
}

fn rand_id() -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
        & 0xFFFF) as u16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping_returns_result() {
        // Loopback should always respond
        let target: IpAddr = "127.0.0.1".parse().unwrap();
        let result = measure_ping(target).await;
        // Loopback may or may not work depending on OS ICMP config,
        // but the function must not panic either way
        let _ = result.latency_ms;
    }
}
