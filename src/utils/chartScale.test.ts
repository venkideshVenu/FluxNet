import { describe, it, expect } from "vitest";
import { formatSpeed, formatBytes, formatLinkSpeed } from "./formatSpeed";

describe("formatSpeed", () => {
  it("returns 0.0 B/s for zero input", () => {
    const result = formatSpeed(0);
    expect(result.value).toBe("0.0");
    expect(result.unit).toBe("B/s");
  });

  it("returns 0.0 for negative input", () => {
    const result = formatSpeed(-100);
    expect(result.value).toBe("0.0");
  });

  it("formats bytes per second", () => {
    const result = formatSpeed(500);
    expect(result.value).toBe("500");
    expect(result.unit).toBe("B/s");
  });

  it("formats kilobytes per second", () => {
    const result = formatSpeed(2048);
    expect(result.value).toBe("2.0");
    expect(result.unit).toBe("KB/s");
  });

  it("formats megabytes per second", () => {
    const result = formatSpeed(5 * 1024 * 1024);
    expect(result.value).toBe("5.0");
    expect(result.unit).toBe("MB/s");
  });

  it("formats gigabytes per second", () => {
    const result = formatSpeed(2 * 1024 * 1024 * 1024);
    expect(result.value).toBe("2.00");
    expect(result.unit).toBe("GB/s");
  });

  describe("forced units", () => {
    it("forces MB/s", () => {
      const result = formatSpeed(1024 * 1024, "MB/s");
      expect(result.value).toBe("1.0");
      expect(result.unit).toBe("MB/s");
    });

    it("forces KB/s", () => {
      const result = formatSpeed(2048, "KB/s");
      expect(result.value).toBe("2.0");
      expect(result.unit).toBe("KB/s");
    });

    it("forces Mbps (megabits)", () => {
      const result = formatSpeed(1_000_000, "Mbps");
      // 1,000,000 bytes * 8 = 8,000,000 bits = 8 Mbps
      expect(result.value).toBe("8.0");
      expect(result.unit).toBe("Mbps");
    });

    it("returns 0.0 with forced unit for zero input", () => {
      const result = formatSpeed(0, "MB/s");
      expect(result.value).toBe("0.0");
      expect(result.unit).toBe("MB/s");
    });
  });
});

describe("formatBytes", () => {
  it("returns 0 B for zero input", () => {
    const result = formatBytes(0);
    expect(result.value).toBe("0");
    expect(result.unit).toBe("B");
  });

  it("formats bytes", () => {
    const result = formatBytes(512);
    expect(result.value).toBe("512");
    expect(result.unit).toBe("B");
  });

  it("formats kilobytes", () => {
    const result = formatBytes(2048);
    expect(result.value).toBe("2.0");
    expect(result.unit).toBe("KB");
  });

  it("formats megabytes", () => {
    const result = formatBytes(10 * 1024 * 1024);
    expect(result.value).toBe("10.0");
    expect(result.unit).toBe("MB");
  });

  it("formats gigabytes", () => {
    const result = formatBytes(5.5 * 1024 * 1024 * 1024);
    expect(result.value).toBe("5.5");
    expect(result.unit).toBe("GB");
  });
});

describe("formatLinkSpeed", () => {
  it("returns '0 bps' for zero", () => {
    expect(formatLinkSpeed(0)).toBe("0 bps");
  });

  it("formats megabits", () => {
    expect(formatLinkSpeed(100_000_000)).toBe("100 Mbps");
  });

  it("formats gigabits", () => {
    expect(formatLinkSpeed(1_000_000_000)).toBe("1.00 Gbps");
  });

  it("formats with correct decimal places", () => {
    expect(formatLinkSpeed(2_500_000_000)).toBe("2.50 Gbps");
    expect(formatLinkSpeed(54_000_000)).toBe("54.0 Mbps");
  });

  it("handles invalid input", () => {
    expect(formatLinkSpeed(-1)).toBe("0 bps");
    expect(formatLinkSpeed(NaN)).toBe("0 bps");
    expect(formatLinkSpeed(Infinity)).toBe("0 bps");
  });
});
