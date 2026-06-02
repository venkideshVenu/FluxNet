import { invoke } from "@tauri-apps/api/core";
import {
  BandwidthSample,
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "../types/persistence";

export async function fetchUsageStats(): Promise<UsageStats> {
  return invoke<UsageStats>("get_usage_stats_cmd");
}

export async function fetchHistoryRange(
  minutes = 60,
): Promise<BandwidthSample[]> {
  return invoke<BandwidthSample[]>("get_history_range", { minutes });
}

export async function fetchHourlySummary(hours = 24): Promise<HourlyUsage[]> {
  return invoke<HourlyUsage[]>("get_hourly_summary", { hours });
}

export async function fetchDailySummary(days = 30): Promise<DailyUsage[]> {
  return invoke<DailyUsage[]>("get_daily_summary", { days });
}

export async function fetchMonthlySummary(): Promise<MonthlyUsage[]> {
  return invoke<MonthlyUsage[]>("get_monthly_summary");
}
