import { describe, it, expect } from "vitest";
import {  formatBytes } from "./formatSpeed";



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
