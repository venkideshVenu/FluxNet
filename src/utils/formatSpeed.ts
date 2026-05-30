/**
 * Converts bytes-per-second to a human-readable string.
 * Returns value and unit separately so the UI can style them independently.
 *
 * Pass `forceUnit` (from the settings store) to override auto-scaling.
 */
export type SpeedResult = {
  value: string;
  unit: string;
};

export type DisplayUnits = "auto" | "MB/s" | "KB/s" | "Mbps";

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

export function formatSpeed(
  bytesPerSec: number,
  forceUnit: DisplayUnits = "auto",
): SpeedResult {
  if (bytesPerSec <= 0 || !isFinite(bytesPerSec)) {
    const unit =
      forceUnit === "auto" ? "B/s" :
      forceUnit === "Mbps" ? "Mbps" :
      forceUnit;
    return { value: "0.0", unit };
  }

  switch (forceUnit) {
    case "MB/s":
      return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
    case "KB/s":
      return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
    case "Mbps":
      // 1 byte = 8 bits; Mbps = megabits per second
      return { value: ((bytesPerSec * 8) / (1000 * 1000)).toFixed(1), unit: "Mbps" };
    default:
      // auto
      if (bytesPerSec >= GB) return { value: (bytesPerSec / GB).toFixed(2), unit: "GB/s" };
      if (bytesPerSec >= MB) return { value: (bytesPerSec / MB).toFixed(1), unit: "MB/s" };
      if (bytesPerSec >= KB) return { value: (bytesPerSec / KB).toFixed(1), unit: "KB/s" };
      return { value: bytesPerSec.toFixed(0), unit: "B/s" };
  }
}