export type SpeedResult = {
  value: string;
  unit: string;
};

export type DisplayUnits = "auto" | "MB/s" | "KB/s" | "Mbps";

export type BytesResult = {
  value: string;
  unit: string;
};

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

export function formatSpeed(
  bytesPerSec: number,
  forceUnit: DisplayUnits = "auto",
): SpeedResult {
  if (bytesPerSec <= 0 || !isFinite(bytesPerSec)) {
    const unit =
      forceUnit === "auto" ? "B/s" : forceUnit === "Mbps" ? "Mbps" : forceUnit;
    return { value: "0.0", unit };
  }

  switch (forceUnit) {
    case "MB/s":
      return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
    case "KB/s":
      return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
    case "Mbps":
      return {
        value: ((bytesPerSec * 8) / (1000 * 1000)).toFixed(1),
        unit: "Mbps",
      };
    default:
      if (bytesPerSec >= GB)
        return { value: (bytesPerSec / GB).toFixed(2), unit: "GB/s" };
      if (bytesPerSec >= MB)
        return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
      if (bytesPerSec >= KB)
        return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
      return { value: bytesPerSec.toFixed(0), unit: "B/s" };
  }
}

export function formatBytes(bytes: number): BytesResult {
  if (bytes <= 0 || !isFinite(bytes)) {
    return { value: "0", unit: "B" };
  }

  if (bytes >= GB) return { value: (bytes / GB).toFixed(1), unit: "GB" };
  if (bytes >= MB) return { value: (bytes / MB).toFixed(1), unit: "MB" };
  if (bytes >= KB) return { value: (bytes / KB).toFixed(1), unit: "KB" };
  return { value: bytes.toFixed(0), unit: "B" };
}

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
 */
export function getAdaptiveChartUnit(maxBytesPerSec: number): {
  divisor: number;
  unitLabel: string;
} {
  if (maxBytesPerSec >= GB) return { divisor: GB, unitLabel: "GB/s" };
  if (maxBytesPerSec >= MB) return { divisor: MB, unitLabel: "MB/s" };
  if (maxBytesPerSec >= KB) return { divisor: KB, unitLabel: "KB/s" };
  return { divisor: 1, unitLabel: "B/s" };
}
