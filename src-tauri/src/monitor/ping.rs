use std::net::IpAddr;
use std::time::Duration;

pub struct PingResult {
    pub latency_ms: Option<f64>,
    pub loss: bool,
}

// ── Raw FFI declarations at module level (Windows only) ───────────────────────
// iphlpapi.dll is already linked by the `windows` crate (GetAdaptersAddresses).
// These functions live in the same DLL, so no additional #[link] is needed.

#[cfg(windows)]
#[repr(C)]
#[allow(non_snake_case, non_camel_case_types, dead_code)]
struct IP_OPTION_INFORMATION {
    Ttl: u8,
    Tos: u8,
    Flags: u8,
    OptionsSize: u8,
    OptionsData: *mut u8,
}

#[cfg(windows)]
#[repr(C)]
#[allow(non_snake_case, non_camel_case_types, dead_code)]
struct ICMP_ECHO_REPLY {
    Address: u32,
    Status: u32,
    RoundTripTime: u32,
    DataSize: u16,
    Reserved: u16,
    Data: *mut u8,
    Options: IP_OPTION_INFORMATION,
}

#[cfg(windows)]
type HANDLE = *mut std::ffi::c_void;

#[cfg(windows)]
#[link(name = "iphlpapi")]
unsafe extern "system" {
    fn IcmpCreateFile() -> HANDLE;
    fn IcmpCloseHandle(IcmpHandle: HANDLE) -> i32;
    fn IcmpSendEcho(
        IcmpHandle: HANDLE,
        DestinationAddress: u32,
        RequestData: *const u8,
        RequestSize: u16,
        RequestOptions: *const IP_OPTION_INFORMATION,
        ReplyBuffer: *mut u8,
        ReplySize: u32,
        Timeout: u32,
    ) -> u32;
}

#[cfg(windows)]
const INVALID_HANDLE_VALUE: HANDLE = -1isize as HANDLE;

// ── Public API ────────────────────────────────────────────────────────────────

/// Measure ping using the Windows ICMP API (IcmpSendEcho).
/// Does NOT use raw sockets, does NOT require admin, does NOT flash a console.
///
/// On other platforms (development only) this falls back to timing a TCP
/// connect, since unprivileged ICMP is not portable.
pub async fn measure_ping(target: IpAddr) -> PingResult {
    let target = match target {
        IpAddr::V4(v4) => v4,
        IpAddr::V6(_) => {
            return PingResult {
                latency_ms: None,
                loss: true,
            };
        }
    };

    #[cfg(windows)]
    let probe = ping_icmp_v4;
    #[cfg(not(windows))]
    let probe = ping_tcp_v4;

    tokio::task::spawn_blocking(move || probe(target, Duration::from_secs(2)))
        .await
        .unwrap_or(PingResult {
            latency_ms: None,
            loss: true,
        })
}

#[cfg(not(windows))]
fn ping_tcp_v4(target: std::net::Ipv4Addr, timeout: Duration) -> PingResult {
    use std::io::ErrorKind;
    use std::net::{SocketAddr, TcpStream};

    let addr = SocketAddr::from((target, 443));
    let started = std::time::Instant::now();
    match TcpStream::connect_timeout(&addr, timeout) {
        // A refused connection still proves the host answered.
        Ok(_) => {}
        Err(e) if e.kind() == ErrorKind::ConnectionRefused => {}
        Err(_) => {
            return PingResult {
                latency_ms: None,
                loss: true,
            };
        }
    }
    PingResult {
        latency_ms: Some(started.elapsed().as_secs_f64() * 1000.0),
        loss: false,
    }
}

#[cfg(windows)]
fn ping_icmp_v4(target: std::net::Ipv4Addr, timeout: Duration) -> PingResult {
    let handle = unsafe { IcmpCreateFile() };
    if handle == INVALID_HANDLE_VALUE || handle.is_null() {
        tracing::debug!("IcmpCreateFile failed");
        return PingResult {
            latency_ms: None,
            loss: true,
        };
    }

    let dest_addr = u32::from_ne_bytes(target.octets());
    let send_data: [u8; 32] = [0x41; 32];
    let timeout_ms = timeout.as_millis() as u32;

    let reply_size = std::mem::size_of::<ICMP_ECHO_REPLY>() + send_data.len() + 8;
    // ICMP_ECHO_REPLY contains a pointer, so back the buffer with u64s to
    // guarantee 8-byte alignment for the cast below.
    let mut reply_buffer = vec![0u64; reply_size.div_ceil(8)];

    let num_replies = unsafe {
        IcmpSendEcho(
            handle,
            dest_addr,
            send_data.as_ptr(),
            send_data.len() as u16,
            std::ptr::null(),
            reply_buffer.as_mut_ptr() as *mut u8,
            reply_size as u32,
            timeout_ms,
        )
    };

    let result = if num_replies > 0 {
        let reply = unsafe { &*(reply_buffer.as_ptr() as *const ICMP_ECHO_REPLY) };
        if reply.Status == 0 {
            PingResult {
                latency_ms: Some(reply.RoundTripTime as f64),
                loss: false,
            }
        } else {
            PingResult {
                latency_ms: None,
                loss: true,
            }
        }
    } else {
        PingResult {
            latency_ms: None,
            loss: true,
        }
    };

    unsafe {
        IcmpCloseHandle(handle);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping_localhost() {
        let target: IpAddr = "127.0.0.1".parse().unwrap();
        let result = measure_ping(target).await;
        assert!(!result.loss);
        assert!(result.latency_ms.is_some());
    }
}
