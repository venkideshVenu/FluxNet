import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatSpeed,
  getAdaptiveChartUnit,
  getAdaptiveBytesUnit,
} from "./formatSpeed";

describe("formatBytes", () => {
  it("should return 0 B for zero input", () => {
    expect(formatBytes(0)).toEqual({ value: "0", unit: "B" });
  });

  it("should return 0 B for negative input", () => {
    expect(formatBytes(-100)).toEqual({ value: "0", unit: "B" });
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toEqual({ value: "500", unit: "B" });
  });

  it("should format kilobytes", () => {
    const result = formatBytes(1024 * 50);
    expect(result).toEqual({ value: "50.0", unit: "KB" });
  });

  it("should format megabytes", () => {
    const result = formatBytes(1024 * 1024 * 25);
    expect(result).toEqual({ value: "25.0", unit: "MB" });
  });

  it("should format gigabytes", () => {
    const result = formatBytes(1024 * 1024 * 1024 * 2.5);
    expect(result).toEqual({ value: "2.5", unit: "GB" });
  });

  it("should handle Infinity and NaN gracefully", () => {
    expect(formatBytes(Infinity)).toEqual({ value: "0", unit: "B" });
    expect(formatBytes(NaN)).toEqual({ value: "0", unit: "B" });
  });

  it("moves up a unit instead of rounding to 1024", () => {
    expect(formatBytes(1024 * 1024 - 1)).toEqual({ value: "1.0", unit: "MB" });
    expect(formatBytes(1023.6)).toEqual({ value: "1.0", unit: "KB" });
  });
});

describe("formatSpeed (bytes)", () => {
  it.each([
    [0, "0.0", "B/s"],
    [-5, "0.0", "B/s"],
    [NaN, "0.0", "B/s"],
    [Infinity, "0.0", "B/s"],
    [512, "512", "B/s"],
    [1024, "1.0", "KB/s"],
    [1_048_576, "1.0", "MB/s"],
    [5_242_880, "5.0", "MB/s"],
    [1024 ** 3, "1.00", "GB/s"],
  ])("formatSpeed(%d) → %s %s", (input, value, unit) => {
    expect(formatSpeed(input)).toEqual({ value, unit });
  });

  it.each([
    [1023.6, "1.0", "KB/s"],
    [1_048_575, "1.0", "MB/s"],
    [1_073_741_823, "1.00", "GB/s"],
  ])("rounds %d up to the next unit, not 1024.x", (input, value, unit) => {
    expect(formatSpeed(input)).toEqual({ value, unit });
  });

  it("never shows a value of 1024 or more below GB/s", () => {
    for (let exp = 0; exp < 30; exp += 1) {
      for (const delta of [-1, -0.4, 0, 0.4]) {
        const { value, unit } = formatSpeed(2 ** exp + delta);
        if (unit !== "GB/s") expect(Number(value)).toBeLessThan(1024);
      }
    }
  });
});

describe("formatSpeed (bits)", () => {
  it.each([
    [0, "0.0", "bps"],
    [100, "800", "bps"],
    [125, "1.0", "Kbps"],
    [125_000, "1.0", "Mbps"],
    [125_000_000, "1.00", "Gbps"],
  ])("formatSpeed(%d, bits) → %s %s", (input, value, unit) => {
    expect(formatSpeed(input, "bits")).toEqual({ value, unit });
  });

  it.each([
    [124.99, "1.0", "Kbps"],
    [124_999, "1.0", "Mbps"],
    [124_999_999, "1.00", "Gbps"],
  ])(
    "rounds %d bytes/s up to the next unit, not 1000.x",
    (input, value, unit) => {
      expect(formatSpeed(input, "bits")).toEqual({ value, unit });
    },
  );
});

describe("getAdaptiveChartUnit", () => {
  it("picks byte units by max value", () => {
    expect(getAdaptiveChartUnit(0)).toEqual({ divisor: 1, unitLabel: "B/s" });
    expect(getAdaptiveChartUnit(2048)).toEqual({
      divisor: 1024,
      unitLabel: "KB/s",
    });
    expect(getAdaptiveChartUnit(3 * 1024 ** 2).unitLabel).toBe("MB/s");
    expect(getAdaptiveChartUnit(3 * 1024 ** 3).unitLabel).toBe("GB/s");
  });

  it("uses bit divisors expressed in bytes", () => {
    expect(getAdaptiveChartUnit(10, "bits")).toEqual({
      divisor: 1 / 8,
      unitLabel: "bps",
    });
    expect(getAdaptiveChartUnit(125, "bits")).toEqual({
      divisor: 125,
      unitLabel: "Kbps",
    });
    expect(getAdaptiveChartUnit(125_000, "bits")).toEqual({
      divisor: 125_000,
      unitLabel: "Mbps",
    });
    // A value divided by the divisor gives the displayed number.
    const { divisor } = getAdaptiveChartUnit(250_000, "bits");
    expect(250_000 / divisor).toBe(2);
  });
});

describe("getAdaptiveBytesUnit", () => {
  it("picks total-byte units", () => {
    expect(getAdaptiveBytesUnit(10).unitLabel).toBe("B");
    expect(getAdaptiveBytesUnit(2048).unitLabel).toBe("KB");
    expect(getAdaptiveBytesUnit(2 * 1024 ** 2).unitLabel).toBe("MB");
    expect(getAdaptiveBytesUnit(2 * 1024 ** 3).unitLabel).toBe("GB");
  });
});
