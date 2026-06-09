import { describe, it, expect } from "vitest";
import { computeChartScale } from "./chartScale";

describe("computeChartScale", () => {
  it("should handle very small values (< 0.1)", () => {
    const result = computeChartScale(0.05);
    expect(result.step).toBe(0.02);
    expect(result.yMax).toBeGreaterThanOrEqual(0.05);
    expect(result.precision).toBe(2);
  });

  it("should handle small values (0.1 - 0.5)", () => {
    const result = computeChartScale(0.3);
    expect(result.step).toBe(0.1);
    expect(result.yMax).toBeGreaterThanOrEqual(0.3);
    expect(result.precision).toBe(2);
  });

  it("should handle medium-small values (0.5 - 1)", () => {
    const result = computeChartScale(0.7);
    expect(result.step).toBe(0.2);
    expect(result.yMax).toBeGreaterThanOrEqual(0.7);
    expect(result.precision).toBe(2);
  });

  it("should handle medium values (1 - 2)", () => {
    const result = computeChartScale(1.5);
    expect(result.step).toBe(0.5);
    expect(result.yMax).toBeGreaterThanOrEqual(1.5);
    expect(result.precision).toBe(1);
  });

  it("should handle values (2 - 5)", () => {
    const result = computeChartScale(3);
    expect(result.step).toBe(1);
    expect(result.yMax).toBeGreaterThanOrEqual(3);
    expect(result.precision).toBe(1);
  });

  it("should handle values (5 - 20)", () => {
    const result = computeChartScale(12);
    expect(result.step).toBe(2);
    expect(result.yMax).toBeGreaterThanOrEqual(12);
    expect(result.precision).toBe(0);
  });

  it("should handle values (20 - 50)", () => {
    const result = computeChartScale(35);
    expect(result.step).toBe(5);
    expect(result.yMax).toBeGreaterThanOrEqual(35);
    expect(result.precision).toBe(0);
  });

  it("should handle values (50 - 100)", () => {
    const result = computeChartScale(75);
    expect(result.step).toBe(10);
    expect(result.yMax).toBeGreaterThanOrEqual(75);
    expect(result.precision).toBe(0);
  });

  it("should handle values (100 - 200)", () => {
    const result = computeChartScale(150);
    expect(result.step).toBe(20);
    expect(result.yMax).toBeGreaterThanOrEqual(150);
    expect(result.precision).toBe(0);
  });

  it("should handle values (200 - 500)", () => {
    const result = computeChartScale(350);
    expect(result.step).toBe(50);
    expect(result.yMax).toBeGreaterThanOrEqual(350);
    expect(result.precision).toBe(0);
  });

  it("should handle very large values (> 500)", () => {
    const result = computeChartScale(800);
    expect(result.step).toBe(100);
    expect(result.yMax).toBeGreaterThanOrEqual(800);
    expect(result.precision).toBe(0);
  });

  it("should handle zero", () => {
    const result = computeChartScale(0);
    expect(result.step).toBe(0.02);
    expect(result.yMax).toBe(0.02); // Math.max(step, 0)
    expect(result.precision).toBe(2);
  });

  it("yMax should always be a multiple of step", () => {
    const testValues = [0.03, 0.4, 0.8, 1.3, 4, 15, 40, 80, 180, 400, 700];
    for (const val of testValues) {
      const result = computeChartScale(val);
      const remainder = result.yMax % result.step;
      expect(remainder).toBeCloseTo(0, 10);
    }
  });
});
