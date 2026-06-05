use std::net::IpAddr;
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::Duration;
use surge_ping::{Client, Config, PingIdentifier, PingSequence};
use tokio::time::timeout;

static PING_ID_COUNTER: AtomicU16 = AtomicU16::new(1);

fn next_ping_id() -> u16 {
    PING_ID_COUNTER.fetch_add(1, Ordering::Relaxed)
}

pub struct PingResult {
    pub latency_ms: Option<f64>,
    pub loss: bool,
}

pub async fn measure_ping(target: IpAddr) -> PingResult {
    let config = Config::builder().build();
    let client = match Client::new(&config) {
        Ok(c) => c,
        Err(_) => {
            return PingResult {
                latency_ms: None,
                loss: true,
            };
        }
    };

    let payload = [0u8; 8];
    let mut pinger = client.pinger(target, PingIdentifier(next_ping_id())).await;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping_returns_result() {
        let target: IpAddr = "127.0.0.1".parse().unwrap();
        let result = measure_ping(target).await;
        let _ = result.latency_ms;
    }
}
