/**
 * Converts bytes-per-second to a human-readable string.
 * Returns value and unit separately so the UI can style them independently.
 */
export type SpeedResult = {
  value: string;
  unit: string;
};

export function formatSpeed(bytesPerSec: number): SpeedResult {
  if (bytesPerSec <= 0 || !isFinite(bytesPerSec)) {
    return { value: "0.0", unit: "B/s" };
  }

  const KB = 1024;
  const MB = 1024 * KB;
  const GB = 1024 * MB;

  if (bytesPerSec >= GB) {
    return { value: (bytesPerSec / GB).toFixed(2), unit: "GB/s" };
  }
  if (bytesPerSec >= MB) {
    return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
  }
  if (bytesPerSec >= KB) {
    return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
  }
  return { value: bytesPerSec.toFixed(0), unit: "B/s" };
}