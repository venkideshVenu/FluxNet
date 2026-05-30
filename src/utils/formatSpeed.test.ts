import { describe, it, expect } from "vitest";
import { formatSpeed } from "./formatSpeed";

describe("formatSpeed", () => {
  it("returns 0.0 B/s for zero input", () => {
    const r = formatSpeed(0);
    expect(r.value).toBe("0.0");
    expect(r.unit).toBe("B/s");
  });

  it("formats bytes correctly", () => {
    const r = formatSpeed(500);
    expect(r.value).toBe("500");
    expect(r.unit).toBe("B/s");
  });

  it("formats kilobytes correctly", () => {
    const r = formatSpeed(1536); // 1.5 KB
    expect(r.value).toBe("1.5");
    expect(r.unit).toBe("KB/s");
  });

  it("formats megabytes correctly", () => {
    const r = formatSpeed(12_582_912); // 12.0 MB
    expect(r.value).toBe("12.0");
    expect(r.unit).toBe("MB/s");
  });

  it("formats gigabytes correctly", () => {
    const r = formatSpeed(1_073_741_824); // 1 GB
    expect(r.value).toBe("1.00");
    expect(r.unit).toBe("GB/s");
  });

  it("handles negative values safely", () => {
    const r = formatSpeed(-100);
    expect(r.value).toBe("0.0");
    expect(r.unit).toBe("B/s");
  });

  it("handles Infinity safely", () => {
    const r = formatSpeed(Infinity);
    expect(r.value).toBe("0.0");
    expect(r.unit).toBe("B/s");
  });
});
