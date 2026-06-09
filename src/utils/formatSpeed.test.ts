import { describe, it, expect } from "vitest";
import { formatSpeed, formatBytes } from "./formatSpeed";

describe("formatSpeed", () => {
  describe("auto mode", () => {
    it("should return 0.0 B/s for zero input", () => {
      const result = formatSpeed(0);
      expect(result).toEqual({ value: "0.0", unit: "B/s" });
    });

    it("should return 0.0 B/s for negative input", () => {
      const result = formatSpeed(-100);
      expect(result).toEqual({ value: "0.0", unit: "B/s" });
    });

    it("should format bytes per second", () => {
      const result = formatSpeed(500);
      expect(result).toEqual({ value: "500", unit: "B/s" });
    });

    it("should format kilobytes per second", () => {
      const result = formatSpeed(1024 * 50);
      expect(result).toEqual({ value: "50.0", unit: "KB/s" });
    });

    it("should format megabytes per second", () => {
      const result = formatSpeed(1024 * 1024 * 25);
      expect(result).toEqual({ value: "25.0", unit: "MB/s" });
    });

    it("should format gigabytes per second", () => {
      const result = formatSpeed(1024 * 1024 * 1024 * 1.5);
      expect(result).toEqual({ value: "1.50", unit: "GB/s" });
    });

    it("should handle Infinity gracefully", () => {
      const result = formatSpeed(Infinity);
      expect(result).toEqual({ value: "0.0", unit: "B/s" });
    });

    it("should handle NaN gracefully", () => {
      const result = formatSpeed(NaN);
      expect(result).toEqual({ value: "0.0", unit: "B/s" });
    });
  });

  describe("forced units", () => {
    it("should force MB/s", () => {
      const result = formatSpeed(1024 * 1024 * 10, "MB/s");
      expect(result).toEqual({ value: "10.0", unit: "MB/s" });
    });

    it("should force KB/s", () => {
      const result = formatSpeed(1024 * 100, "KB/s");
      expect(result).toEqual({ value: "100.0", unit: "KB/s" });
    });

    it("should force Mbps", () => {
      // 1 MB/s = 8 Mbps (roughly, using 1000*1000 for Mbps)
      const result = formatSpeed(1000 * 1000, "Mbps");
      expect(result).toEqual({ value: "8.0", unit: "Mbps" });
    });

    it("should return 0.0 with forced unit for zero", () => {
      expect(formatSpeed(0, "MB/s")).toEqual({ value: "0.0", unit: "MB/s" });
      expect(formatSpeed(0, "KB/s")).toEqual({ value: "0.0", unit: "KB/s" });
      expect(formatSpeed(0, "Mbps")).toEqual({ value: "0.0", unit: "Mbps" });
    });
  });
});

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

  it("should handle Infinity gracefully", () => {
    expect(formatBytes(Infinity)).toEqual({ value: "0", unit: "B" });
  });
});
