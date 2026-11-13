import { describe, it, expect } from "vitest";
import type {
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "@/types";
import {
  dayKey,
  hasData,
  hourLabel,
  hourlyBuckets,
  monthlyBuckets,
  weeklyBuckets,
} from "./usageBuckets";

const MB = 1024 * 1024;

function hour(date: Date, h: number, down: number, up = 0): HourlyUsage {
  return {
    hourStart:
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        h,
      ).getTime() / 1000,
    avgDownloadBps: 0,
    avgUploadBps: 0,
    peakDownloadBps: 0,
    peakUploadBps: 0,
    totalDownloadBytes: down,
    totalUploadBytes: up,
    sampleCount: 1,
  };
}

function day(key: string, down: number): DailyUsage {
  return {
    day: key,
    avgDownloadBps: 0,
    avgUploadBps: 0,
    peakDownloadBps: 0,
    peakUploadBps: 0,
    totalDownloadBytes: down,
    totalUploadBytes: down / 10,
  };
}

describe("hourlyBuckets", () => {
  // Wednesday 13 May 2026, 14:30 local time.
  const now = new Date(2026, 4, 13, 14, 30);

  it("always returns all 24 hours, with gaps kept as empty slots", () => {
    const buckets = hourlyBuckets(
      [hour(now, 9, 5 * MB), hour(now, 12, 2 * MB)],
      now,
      "24h",
    );
    expect(buckets).toHaveLength(24);
    expect(buckets[9].download).toBe(5 * MB);
    expect(buckets[10].download).toBe(0);
    expect(buckets[12].download).toBe(2 * MB);
  });

  it("marks later hours as future and the current hour as partial", () => {
    const buckets = hourlyBuckets([], now, "24h");
    expect(buckets[13].future).toBe(false);
    expect(buckets[14].partial).toBe(true);
    expect(buckets[14].future).toBe(false);
    expect(buckets[15].future).toBe(true);
  });

  it("fills the current hour from today's total minus completed hours", () => {
    const buckets = hourlyBuckets([hour(now, 9, 5 * MB, MB)], now, "24h", {
      download: 8 * MB,
      upload: 3 * MB,
    });
    expect(buckets[14].download).toBe(3 * MB);
    expect(buckets[14].upload).toBe(2 * MB);
  });

  it("ignores rows from other days", () => {
    const yesterday = new Date(2026, 4, 12, 14);
    const buckets = hourlyBuckets([hour(yesterday, 9, 5 * MB)], now, "24h");
    expect(hasData(buckets)).toBe(false);
  });

  it("labels hours in the chosen clock format", () => {
    expect(hourLabel(0, "12h")).toBe("12 AM");
    expect(hourLabel(15, "12h")).toBe("3 PM");
    expect(hourLabel(9, "24h")).toBe("09:00");
    expect(hourlyBuckets([], now, "12h")[23].title).toBe("11 PM – 12 AM");
  });
});

describe("weeklyBuckets", () => {
  const wed = new Date(2026, 4, 13, 10);

  it.each([
    ["sunday", "Sun 10"],
    ["monday", "Mon 11"],
    ["saturday", "Sat 9"],
  ] as const)("starts the week on %s", (start, firstLabel) => {
    const buckets = weeklyBuckets([], wed, start);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].label).toBe(firstLabel);
  });

  it("places days by date and marks today and future days", () => {
    const buckets = weeklyBuckets(
      [day("2026-05-11", 4 * MB), day("2026-05-13", MB)],
      wed,
      "monday",
    );
    expect(buckets[0].download).toBe(4 * MB);
    expect(buckets[1].download).toBe(0);
    expect(buckets[2].partial).toBe(true);
    expect(buckets[2].download).toBe(MB);
    expect(buckets[3].future).toBe(true);
  });

  it("works across a month boundary", () => {
    const buckets = weeklyBuckets([], new Date(2026, 5, 2), "monday");
    expect(buckets.map((b) => b.key)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("monthlyBuckets", () => {
  const now = new Date(2026, 1, 10); // February 2026
  const stats: UsageStats = {
    todayDownloadBytes: 0,
    todayUploadBytes: 0,
    weekDownloadBytes: 0,
    weekUploadBytes: 0,
    monthDownloadBytes: 7 * MB,
    monthUploadBytes: MB,
    peakDownloadBps: 0,
    peakUploadBps: 0,
  };
  const jan: MonthlyUsage = {
    month: "2026-01",
    totalDownloadBytes: 50 * MB,
    totalUploadBytes: 5 * MB,
    peakDownloadBps: 0,
    peakUploadBps: 0,
  };

  it("returns the last 12 months, oldest first, crossing the year", () => {
    const buckets = monthlyBuckets([jan], now, stats);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].key).toBe("2025-03");
    expect(buckets[11].key).toBe("2026-02");
    expect(buckets[10].download).toBe(50 * MB);
  });

  it("takes the current month from live stats", () => {
    const buckets = monthlyBuckets([jan], now, stats);
    expect(buckets[11].partial).toBe(true);
    expect(buckets[11].download).toBe(7 * MB);
    expect(buckets[11].upload).toBe(MB);
  });

  it("shows the year on the first bucket and on January", () => {
    const labels = monthlyBuckets([], now, null).map((b) => b.label);
    expect(labels[0]).toBe("Mar 25");
    expect(labels[10]).toBe("Jan 26");
    expect(labels[11]).toBe("Feb");
  });
});
