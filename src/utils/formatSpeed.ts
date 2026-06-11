export type SpeedResult = {
  value: string;
  unit: string;
};

export type BytesResult = {
  value: string;
  unit: string;
};

export type DisplayUnits = "bytes" | "bits";

// Binary (base 1024) thresholds for Bytes mode
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

// Decimal (base 1000) thresholds for Bits mode
const Kbit = 1000;
const Mbit = 1000 * Kbit;
const Gbit = 1000 * Mbit;

/**
 * Format a bytes-per-second value into a human-readable speed string.
 *
 * - "bytes" mode: adaptive B/s → KB/s → MB/s → GB/s (base 1024)
 * - "bits" mode:  adaptive bps → Kbps → Mbps → Gbps (base 1000, value × 8)
 */
export function formatSpeed(
  bytesPerSec: number,
  mode: DisplayUnits = "bytes",
): SpeedResult {
  if (bytesPerSec <= 0 || !isFinite(bytesPerSec)) {
    return { value: "0.0", unit: mode === "bits" ? "bps" : "B/s" };
  }

  if (mode === "bits") {
    const bitsPerSec = bytesPerSec * 8;
    if (bitsPerSec >= Gbit)
      return { value: (bitsPerSec / Gbit).toFixed(2), unit: "Gbps" };
    if (bitsPerSec >= Mbit)
      return { value: (bitsPerSec / Mbit).toFixed(1), unit: "Mbps" };
    if (bitsPerSec >= Kbit)
      return { value: (bitsPerSec / Kbit).toFixed(1), unit: "Kbps" };
    return { value: bitsPerSec.toFixed(0), unit: "bps" };
  }

  // Bytes mode (default)
  if (bytesPerSec >= GB)
    return { value: (bytesPerSec / GB).toFixed(2), unit: "GB/s" };
  if (bytesPerSec >= MB)
    return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
  if (bytesPerSec >= KB)
    return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
  return { value: bytesPerSec.toFixed(0), unit: "B/s" };
}

/**
 * Format a total byte count into human-readable form (always base 1024).
 */
export function formatBytes(bytes: number): BytesResult {
  if (bytes <= 0 || !isFinite(bytes)) {
    return { value: "0", unit: "B" };
  }

  if (bytes >= GB) return { value: (bytes / GB).toFixed(1), unit: "GB" };
  if (bytes >= MB) return { value: (bytes / MB).toFixed(1), unit: "MB" };
  if (bytes >= KB) return { value: (bytes / KB).toFixed(1), unit: "KB" };
  return { value: bytes.toFixed(0), unit: "B" };
}

/**
 * Format a link speed in bps into human-readable form (always base 1000).
 */
export function formatLinkSpeed(bps: number): string {
  if (!bps || bps <= 0 || !isFinite(bps)) {
    return "—";
  }

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let value = bps;
  let i = 0;

  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i += 1;
  }

  const rounded =
    value >= 100
      ? value.toFixed(0)
      : value >= 10
        ? value.toFixed(1)
        : value.toFixed(2);
  return `${rounded} ${units[i]}`;
}

/**
 * Adaptive chart unit selection based on the max value (in bytes/sec).
 * Returns { divisor, unitLabel } for chart Y-axis.
 * Adapts to the user's chosen display unit system.
 */
export function getAdaptiveChartUnit(
  maxBytesPerSec: number,
  mode: DisplayUnits = "bytes",
): {
  divisor: number;
  unitLabel: string;
} {
  if (mode === "bits") {
    const maxBits = maxBytesPerSec * 8;
    if (maxBits >= Gbit) return { divisor: Gbit / 8, unitLabel: "Gbps" };
    if (maxBits >= Mbit) return { divisor: Mbit / 8, unitLabel: "Mbps" };
    if (maxBits >= Kbit) return { divisor: Kbit / 8, unitLabel: "Kbps" };
    return { divisor: 1 / 8, unitLabel: "bps" };
  }

  // Bytes mode
  if (maxBytesPerSec >= GB) return { divisor: GB, unitLabel: "GB/s" };
  if (maxBytesPerSec >= MB) return { divisor: MB, unitLabel: "MB/s" };
  if (maxBytesPerSec >= KB) return { divisor: KB, unitLabel: "KB/s" };
  return { divisor: 1, unitLabel: "B/s" };
}

/**
 * Get adaptive unit for total bytes (used in history charts).
 * Always uses base 1024.
 */
export function getAdaptiveBytesUnit(maxBytes: number): {
  divisor: number;
  unitLabel: string;
} {
  if (maxBytes >= GB) return { divisor: GB, unitLabel: "GB" };
  if (maxBytes >= MB) return { divisor: MB, unitLabel: "MB" };
  if (maxBytes >= KB) return { divisor: KB, unitLabel: "KB" };
  return { divisor: 1, unitLabel: "B" };
}
