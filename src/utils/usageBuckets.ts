/**
 * Turns stored usage rows into complete, evenly spaced chart buckets: every
 * hour of today, every day of this week, every one of the last 12 months.
 * Periods without data are kept as empty slots so the time axis is honest
 * (no 13:00 → 17:00 jumps), and periods that haven't happened yet are marked
 * `future` so they can be drawn as blank space.
 */
import type { DailyUsage, HourlyUsage, MonthlyUsage, UsageStats } from "@/types";

export type Bucket = {
  key: string;
  /** Short axis label. */
  label: string;
  /** Long label for tooltips and the table view. */
  title: string;
  download: number;
  upload: number;
  future: boolean;
  /** True when this bucket is still being measured (current hour/day/month). */
  partial: boolean;
};

export type TimeFormat = "12h" | "24h";
export type WeekStart = "sunday" | "monday" | "saturday";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_START_DAY: Record<WeekStart, number> = { sunday: 0, monday: 1, saturday: 6 };

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hourLabel(hour: number, format: TimeFormat): string {
  if (format === "24h") return `${String(hour).padStart(2, "0")}:00`;
  const h12 = hour % 12 || 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * 24 hourly buckets for the local day containing `now`. Completed hours come
 * from `hourly`; the current hour is today's total minus completed hours,
 * when `todayTotals` is known.
 */
export function hourlyBuckets(
  hourly: HourlyUsage[],
  now: Date,
  format: TimeFormat,
  todayTotals?: { download: number; upload: number },
): Bucket[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const buckets: Bucket[] = [];
  let completedDown = 0;
  let completedUp = 0;
  let current: Bucket | null = null;

  for (let h = 0; h < 24; h++) {
    const start = new Date(y, m, d, h).getTime() / 1000;
    const end = new Date(y, m, d, h + 1).getTime() / 1000;
    const rows = hourly.filter((r) => r.hourStart >= start && r.hourStart < end);
    const download = rows.reduce((s, r) => s + r.totalDownloadBytes, 0);
    const upload = rows.reduce((s, r) => s + r.totalUploadBytes, 0);
    const nowSec = now.getTime() / 1000;
    const isCurrent = nowSec >= start && nowSec < end;
    const bucket: Bucket = {
      key: String(h),
      label: hourLabel(h, format),
      title: `${hourLabel(h, format)} – ${hourLabel((h + 1) % 24, format)}`,
      download,
      upload,
      future: start > nowSec,
      partial: isCurrent,
    };
    if (isCurrent) current = bucket;
    else if (!bucket.future) {
      completedDown += download;
      completedUp += upload;
    }
    buckets.push(bucket);
  }

  if (current && todayTotals) {
    current.download = Math.max(current.download, todayTotals.download - completedDown);
    current.upload = Math.max(current.upload, todayTotals.upload - completedUp);
  }
  return buckets;
}

/** Seven daily buckets for the week containing `now`. */
export function weeklyBuckets(
  daily: DailyUsage[],
  now: Date,
  weekStart: WeekStart,
): Bucket[] {
  const byDay = new Map(daily.map((r) => [r.day, r]));
  const offset = (now.getDay() - WEEK_START_DAY[weekStart] + 7) % 7;
  const today = dayKey(now);
  const buckets: Bucket[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + i);
    const key = dayKey(date);
    const row = byDay.get(key);
    buckets.push({
      key,
      label: `${WEEKDAYS[date.getDay()]} ${date.getDate()}`,
      title: date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      download: row?.totalDownloadBytes ?? 0,
      upload: row?.totalUploadBytes ?? 0,
      future: key > today,
      partial: key === today,
    });
  }
  return buckets;
}

/**
 * The last `count` months, oldest first. Completed months come from
 * `monthly`; the current month (not stored until it ends) comes from `stats`.
 */
export function monthlyBuckets(
  monthly: MonthlyUsage[],
  now: Date,
  stats: UsageStats | null,
  count = 12,
): Bucket[] {
  const byMonth = new Map(monthly.map((r) => [r.month, r]));
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const isCurrent = i === 0;
    const row = byMonth.get(key);
    const label = MONTHS[date.getMonth()];
    buckets.push({
      key,
      // Show the year on January and on the first bucket so the axis is unambiguous.
      label:
        date.getMonth() === 0 || i === count - 1
          ? `${label} ${String(date.getFullYear()).slice(2)}`
          : label,
      title: date.toLocaleDateString([], { month: "long", year: "numeric" }),
      download: isCurrent
        ? (stats?.monthDownloadBytes ?? row?.totalDownloadBytes ?? 0)
        : (row?.totalDownloadBytes ?? 0),
      upload: isCurrent
        ? (stats?.monthUploadBytes ?? row?.totalUploadBytes ?? 0)
        : (row?.totalUploadBytes ?? 0),
      future: false,
      partial: isCurrent,
    });
  }
  return buckets;
}

export function hasData(buckets: Bucket[]): boolean {
  return buckets.some((b) => b.download > 0 || b.upload > 0);
}
