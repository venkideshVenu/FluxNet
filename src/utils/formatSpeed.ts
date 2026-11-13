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

type Scale = { unit: string; divisor: number; digits: number }[];

const BYTE_SPEED_SCALE: Scale = [
  { unit: "B/s", divisor: 1, digits: 0 },
  { unit: "KB/s", divisor: KB, digits: 1 },
  { unit: "MB/s", divisor: MB, digits: 1 },
  { unit: "GB/s", divisor: GB, digits: 2 },
];

const BIT_SPEED_SCALE: Scale = [
  { unit: "bps", divisor: 1, digits: 0 },
  { unit: "Kbps", divisor: Kbit, digits: 1 },
  { unit: "Mbps", divisor: Mbit, digits: 1 },
  { unit: "Gbps", divisor: Gbit, digits: 2 },
];

const BYTE_TOTAL_SCALE: Scale = [
  { unit: "B", divisor: 1, digits: 0 },
  { unit: "KB", divisor: KB, digits: 1 },
  { unit: "MB", divisor: MB, digits: 1 },
  { unit: "GB", divisor: GB, digits: 1 },
];

/**
 * Picks the largest unit the value reaches, then moves up one unit if
 * rounding would display the next unit's base (e.g. 1048575 B/s would
 * otherwise show as "1024.0 KB/s" instead of "1.0 MB/s").
 */
function formatOnScale(value: number, scale: Scale): SpeedResult {
  let i = scale.length - 1;
  while (i > 0 && value < scale[i].divisor) i -= 1;

  let text = (value / scale[i].divisor).toFixed(scale[i].digits);
  while (
    i < scale.length - 1 &&
    Number(text) * scale[i].divisor >= scale[i + 1].divisor
  ) {
    i += 1;
    text = (value / scale[i].divisor).toFixed(scale[i].digits);
  }
  return { value: text, unit: scale[i].unit };
}

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
  if (!(bytesPerSec > 0) || !isFinite(bytesPerSec)) {
    return { value: "0.0", unit: mode === "bits" ? "bps" : "B/s" };
  }
  return mode === "bits"
    ? formatOnScale(bytesPerSec * 8, BIT_SPEED_SCALE)
    : formatOnScale(bytesPerSec, BYTE_SPEED_SCALE);
}

/**
 * Format a total byte count into human-readable form (always base 1024).
 */
export function formatBytes(bytes: number): BytesResult {
  if (!(bytes > 0) || !isFinite(bytes)) {
    return { value: "0", unit: "B" };
  }
  return formatOnScale(bytes, BYTE_TOTAL_SCALE);
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
