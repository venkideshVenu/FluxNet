import { invokeWithTimeout } from "../utils/invokeWithTimeout";
import type {
  BandwidthSample,
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "../types/persistence";

// FIX: Issue 2.2 — Renamed from useStorageApi (not a hook), moved to api/
export async function fetchUsageStats(): Promise<UsageStats> {
  return invokeWithTimeout<UsageStats>("get_usage_stats_cmd");
}

export async function fetchHistoryRange(
  minutes = 60,
): Promise<BandwidthSample[]> {
  return invokeWithTimeout<BandwidthSample[]>("get_history_range", { minutes });
}

export async function fetchHourlySummary(hours = 24): Promise<HourlyUsage[]> {
  return invokeWithTimeout<HourlyUsage[]>("get_hourly_summary", { hours });
}

export async function fetchDailySummary(days = 30): Promise<DailyUsage[]> {
  return invokeWithTimeout<DailyUsage[]>("get_daily_summary", { days });
}

export async function fetchMonthlySummary(): Promise<MonthlyUsage[]> {
  return invokeWithTimeout<MonthlyUsage[]>("get_monthly_summary");
}
