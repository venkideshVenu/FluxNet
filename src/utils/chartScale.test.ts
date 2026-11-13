import { describe, it, expect } from "vitest";
import { formatBytes, formatLinkSpeed } from "./formatSpeed";
import { computeChartScale, chartTicks } from "./chartScale";

describe("computeChartScale", () => {
  it.each([0, -5, NaN, Infinity, -Infinity])(
    "returns a finite minimal axis for %s",
    (input) => {
      const { step, yMax, precision } = computeChartScale(input);
      expect(step).toBe(0.02);
      expect(yMax).toBe(0.02);
      expect(precision).toBe(2);
    },
  );

  it.each([
    [0.1, 0.02],
    [0.5, 0.1],
    [1, 0.2],
    [2, 0.5],
    [5, 1],
    [20, 2],
    [50, 5],
    [100, 10],
    [200, 20],
    [500, 50],
    [501, 100],
  ])("uses step %s → %s at the boundary", (input, step) => {
    expect(computeChartScale(input).step).toBe(step);
  });

  it("yMax is always at least the input and a multiple of step", () => {
    for (const v of [0.07, 0.33, 1.7, 3.3, 17, 43, 99, 151, 499, 1234]) {
      const { step, yMax } = computeChartScale(v);
      expect(yMax).toBeGreaterThanOrEqual(v);
      expect(Math.abs(yMax / step - Math.round(yMax / step))).toBeLessThan(
        1e-9,
      );
    }
  });

  it("chooses precision by magnitude", () => {
    expect(computeChartScale(0.5).precision).toBe(2);
    expect(computeChartScale(5).precision).toBe(1);
    expect(computeChartScale(50).precision).toBe(0);
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
  it("returns a dash for zero (link speed unknown)", () => {
    expect(formatLinkSpeed(0)).toBe("—");
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
    expect(formatLinkSpeed(-1)).toBe("—");
    expect(formatLinkSpeed(NaN)).toBe("—");
    expect(formatLinkSpeed(Infinity)).toBe("—");
  });
});

describe("chartTicks", () => {
  it("gives even, round ticks that cover the data", () => {
    expect(chartTicks(4.6)).toEqual({
      ticks: [0, 1, 2, 3, 4, 5],
      yMax: 5,
      decimals: 0,
    });
  });

  it("never exceeds the tick budget", () => {
    for (const max of [
      0.07, 0.4, 0.9, 1.7, 4.6, 9, 19, 45, 99, 180, 480, 950,
    ]) {
      const { ticks, yMax } = chartTicks(max);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(yMax).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(yMax);
      const steps = ticks.slice(1).map((t, i) => +(t - ticks[i]).toFixed(6));
      expect(new Set(steps).size).toBe(1);
    }
  });

  it("uses only the decimals the step needs", () => {
    expect(chartTicks(9).decimals).toBe(0);
    expect(chartTicks(1.7).decimals).toBe(1);
    expect(chartTicks(0.07).decimals).toBe(2);
  });

  it("handles empty or invalid data", () => {
    expect(chartTicks(0).ticks[0]).toBe(0);
    expect(chartTicks(Number.NaN).yMax).toBeGreaterThan(0);
  });
});
