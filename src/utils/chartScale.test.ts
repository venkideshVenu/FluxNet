import { describe, it, expect } from "vitest";
import { formatBytes, formatLinkSpeed } from "./formatSpeed";

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
