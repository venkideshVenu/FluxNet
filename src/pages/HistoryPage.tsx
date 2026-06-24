import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchDailySummary,
  fetchHourlySummary,
  fetchMonthlySummary,
  fetchUsageStats,
} from "@/api";
import { formatBytes, formatSpeed, getAdaptiveBytesUnit } from "@/utils";
import { useSettingsStore } from "@/store";
import { StatCard, EmptyMessage } from "@/components";
import type {
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "@/types";

type Tab = "today" | "week" | "monthly";

function fmt(result: { value: string; unit: string }): string {
  return `${result.value} ${result.unit}`;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text)",
};

function formatDateString(dateStr: string, format: string): string {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-");
  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "YYYY-MM-DD":
      return dateStr;
    case "MM/DD/YYYY":
    default:
      return `${m}/${d}/${y}`;
  }
}

export function HistoryPage() {
  const [tab, setTab] = useState<Tab>("today");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [hourly, setHourly] = useState<HourlyUsage[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const dateFormat = useSettingsStore((s) => s.dateFormat);
  const startOfWeek = useSettingsStore((s) => s.startOfWeek);

  useEffect(() => {
    async function load(isBackground = false) {
      if (!isBackground) setInitialLoad(true);
      try {
        const [nextStats, nextHourly, nextDaily, nextMonthly] =
          await Promise.all([
            fetchUsageStats(),
            fetchHourlySummary(48),
            fetchDailySummary(30),
            fetchMonthlySummary(),
          ]);
        setStats(nextStats);
        setHourly(nextHourly);
        setDaily(nextDaily);
        setMonthly(nextMonthly);
        setError(null);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : String(caughtError),
        );
      } finally {
        setInitialLoad(false);
      }
    }
    void load(false);
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, []);

  const todayChart = useMemo(() => {
    const now = new Date();
    const todayStart =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() /
      1000;
    const todayHours = hourly.filter((h) => h.hourStart >= todayStart);
    const sorted = [...todayHours].sort((a, b) => a.hourStart - b.hourStart);

    return sorted.map((point) => {
      const date = new Date(point.hourStart * 1000);
      const hour = date.getHours();
      const nextHour = (hour + 1) % 24;

      let label: string;
      if (timeFormat === "24h") {
        label = `${hour.toString().padStart(2, "0")}:00–${nextHour.toString().padStart(2, "0")}:00`;
      } else {
        const fmt12 = (h: number) => {
          const period = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          return `${h12}${period}`;
        };
        label = `${fmt12(hour)}–${fmt12(nextHour)}`;
      }

      return {
        label,
        fullLabel: label,
        downloadRaw: point.totalDownloadBytes,
        uploadRaw: point.totalUploadBytes,
      };
    });
  }, [hourly, timeFormat]);

  const todayMaxBytes = useMemo(
    () =>
      todayChart.reduce(
        (max, p) => Math.max(max, p.downloadRaw, p.uploadRaw),
        0,
      ),
    [todayChart],
  );
  const todayUnit = useMemo(
    () => getAdaptiveBytesUnit(todayMaxBytes),
    [todayMaxBytes],
  );
  const todayChartData = useMemo(
    () =>
      todayChart.map((p) => ({
        ...p,
        download: +(p.downloadRaw / todayUnit.divisor).toFixed(2),
        upload: +(p.uploadRaw / todayUnit.divisor).toFixed(2),
      })),
    [todayChart, todayUnit.divisor],
  );

  const weekChart = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const weekStartDay =
      startOfWeek === "monday" ? 1 : startOfWeek === "saturday" ? 6 : 0;
    let daysSinceStart = currentDay - weekStartDay;
    if (daysSinceStart < 0) daysSinceStart += 7;
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysSinceStart,
    );
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
    const weekDays = daily.filter((d) => d.day >= weekStartStr);
    const sorted = [...weekDays].sort((a, b) => a.day.localeCompare(b.day));
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return sorted.map((point) => {
      const [y, m, d] = point.day.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const dayName = dayNames[date.getDay()];
      const label = `${dayName} ${d}`;
      return {
        label,
        fullLabel: formatDateString(point.day, dateFormat),
        downloadRaw: point.totalDownloadBytes,
        uploadRaw: point.totalUploadBytes,
      };
    });
  }, [daily, startOfWeek, dateFormat]);

  const weekMaxBytes = useMemo(
    () =>
      weekChart.reduce(
        (max, p) => Math.max(max, p.downloadRaw, p.uploadRaw),
        0,
      ),
    [weekChart],
  );
  const weekUnit = useMemo(
    () => getAdaptiveBytesUnit(weekMaxBytes),
    [weekMaxBytes],
  );
  const weekChartData = useMemo(
    () =>
      weekChart.map((p) => ({
        ...p,
        download: +(p.downloadRaw / weekUnit.divisor).toFixed(2),
        upload: +(p.uploadRaw / weekUnit.divisor).toFixed(2),
      })),
    [weekChart, weekUnit.divisor],
  );

  const sortedMonthly = useMemo(
    () => [...monthly].sort((a, b) => a.month.localeCompare(b.month)),
    [monthly],
  );
  const monthlyChart = useMemo(
    () =>
      sortedMonthly.map((point) => ({
        label: formatMonthLabel(point.month),
        fullLabel: point.month,
        downloadRaw: point.totalDownloadBytes,
        uploadRaw: point.totalUploadBytes,
      })),
    [sortedMonthly],
  );
  const monthlyMaxBytes = useMemo(
    () =>
      monthlyChart.reduce(
        (max, p) => Math.max(max, p.downloadRaw, p.uploadRaw),
        0,
      ),
    [monthlyChart],
  );
  const monthlyUnit = useMemo(
    () => getAdaptiveBytesUnit(monthlyMaxBytes),
    [monthlyMaxBytes],
  );
  const monthlyChartData = useMemo(
    () =>
      monthlyChart.map((p) => ({
        ...p,
        download: +(p.downloadRaw / monthlyUnit.divisor).toFixed(2),
        upload: +(p.uploadRaw / monthlyUnit.divisor).toFixed(2),
      })),
    [monthlyChart, monthlyUnit.divisor],
  );

  const summaryCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Today ↓", value: fmt(formatBytes(stats.todayDownloadBytes)) },
      { label: "Today ↑", value: fmt(formatBytes(stats.todayUploadBytes)) },
      {
        label: "This week ↓",
        value: fmt(formatBytes(stats.weekDownloadBytes)),
      },
      {
        label: "This month ↓",
        value: fmt(formatBytes(stats.monthDownloadBytes)),
      },
      {
        label: "Peak download",
        value: fmt(formatSpeed(stats.peakDownloadBps, displayUnits)),
      },
      {
        label: "Peak upload",
        value: fmt(formatSpeed(stats.peakUploadBps, displayUnits)),
      },
    ];
  }, [stats, displayUnits]);

  const currentMonthly = sortedMonthly.at(-1) ?? null;
  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "monthly", label: "Monthly" },
  ];

  const makeFormatter =
    (unitLabel: string) =>
    (value: unknown, name: unknown): [string, string] => {
      const num = typeof value === "number" ? value : Number(value ?? 0);
      const key = String(name);
      return [
        `${num.toFixed(2)} ${unitLabel}`,
        key === "upload" ? "Uploaded" : "Downloaded",
      ];
    };

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
            History
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Bandwidth usage over time — total data transferred per period
          </div>
        </div>
      </div>

      {initialLoad && (
        <div className="text-[12px] text-text-muted text-center py-10">
          Loading history…
        </div>
      )}

      {error && !initialLoad && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 bg-danger-bg border border-danger-border rounded-md text-danger-text text-[12px] mb-4"
          role="alert"
        >
          <span className="flex-1">⚠️ {error}</span>
        </div>
      )}

      {!initialLoad && !error && (
        <>
          {stats && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-3 mb-6">
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`border px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all hover:-translate-y-px ${tab === item.id ? "bg-accent text-white border-accent shadow-[0_2px_8px_rgba(124,111,247,0.3)]" : "bg-panel text-text-subtle border-border-strong hover:border-accent-border hover:text-text"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "today" && (
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
                Data transferred per hour today ({todayUnit.unitLabel})
              </div>
              <div className="bg-panel border border-border rounded-lg p-5">
                {todayChartData.length === 0 ? (
                  <EmptyMessage text="No data yet for today. Data appears after the first completed hour of monitoring." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={todayChartData}
                        barGap={1}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 9 }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={55}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatAxisValue(v)}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={{ color: "var(--text-muted)" }}
                          itemStyle={{ color: "var(--text)" }}
                          formatter={makeFormatter(todayUnit.unitLabel)}
                        />
                        <Bar
                          dataKey="download"
                          fill="var(--net-download)"
                          radius={[3, 3, 0, 0]}
                          opacity={0.85}
                          name="download"
                        />
                        <Bar
                          dataKey="upload"
                          fill="var(--net-upload)"
                          radius={[3, 3, 0, 0]}
                          opacity={0.85}
                          name="upload"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <ChartLegend unitLabel={todayUnit.unitLabel} />
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "week" && (
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
                Data transferred per day this week ({weekUnit.unitLabel})
              </div>
              <div className="bg-panel border border-border rounded-lg p-5">
                {weekChartData.length === 0 ? (
                  <EmptyMessage text="No data yet for this week. Data appears after the first full day of monitoring." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={weekChartData}
                        barGap={2}
                        barCategoryGap="15%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => formatAxisValue(v)}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={{ color: "var(--text-muted)" }}
                          itemStyle={{ color: "var(--text)" }}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullLabel ?? ""
                          }
                          formatter={makeFormatter(weekUnit.unitLabel)}
                        />
                        <Bar
                          dataKey="download"
                          fill="var(--net-download)"
                          radius={[3, 3, 0, 0]}
                          opacity={0.85}
                          name="download"
                        />
                        <Bar
                          dataKey="upload"
                          fill="var(--net-upload)"
                          radius={[3, 3, 0, 0]}
                          opacity={0.85}
                          name="upload"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    <ChartLegend unitLabel={weekUnit.unitLabel} />
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "monthly" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <StatCard
                  label="Latest month ↓"
                  value={
                    currentMonthly
                      ? fmt(formatBytes(currentMonthly.totalDownloadBytes))
                      : "—"
                  }
                />
                <StatCard
                  label="Latest month ↑"
                  value={
                    currentMonthly
                      ? fmt(formatBytes(currentMonthly.totalUploadBytes))
                      : "—"
                  }
                />
                <StatCard
                  label="Latest month total"
                  value={
                    currentMonthly
                      ? fmt(
                          formatBytes(
                            currentMonthly.totalDownloadBytes +
                              currentMonthly.totalUploadBytes,
                          ),
                        )
                      : "—"
                  }
                />
                <StatCard
                  label="Month peak ↓"
                  value={
                    currentMonthly
                      ? fmt(
                          formatSpeed(
                            currentMonthly.peakDownloadBps,
                            displayUnits,
                          ),
                        )
                      : "—"
                  }
                />
              </div>
              <div className="mb-6">
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
                  Total data per month ({monthlyUnit.unitLabel})
                </div>
                <div className="bg-panel border border-border rounded-lg p-5">
                  {monthlyChartData.length === 0 ? (
                    <EmptyMessage text="No monthly data yet. Monthly summaries are generated at the start of each new month." />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={monthlyChartData}
                          barGap={2}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                          />
                          <YAxis
                            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => formatAxisValue(v)}
                            width={42}
                          />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelStyle={{ color: "var(--text-muted)" }}
                            itemStyle={{ color: "var(--text)" }}
                            labelFormatter={(_, payload) =>
                              payload?.[0]?.payload?.fullLabel ?? ""
                            }
                            formatter={makeFormatter(monthlyUnit.unitLabel)}
                          />
                          <Bar
                            dataKey="download"
                            fill="var(--net-download)"
                            radius={[3, 3, 0, 0]}
                            opacity={0.85}
                            name="download"
                          />
                          <Bar
                            dataKey="upload"
                            fill="var(--net-upload)"
                            radius={[3, 3, 0, 0]}
                            opacity={0.85}
                            name="upload"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      <ChartLegend unitLabel={monthlyUnit.unitLabel} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChartLegend({ unitLabel }: { unitLabel: string }) {
  return (
    <div className="flex items-center gap-4 mt-3">
      <div className="flex items-center gap-1.5 text-[11px] text-text-subtle">
        <div className="w-2 h-2 rounded-full bg-net-download" />
        Downloaded
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-text-subtle">
        <div className="w-2 h-2 rounded-full bg-net-upload" />
        Uploaded
      </div>
      <span className="ml-auto text-[10px] text-text-muted">{unitLabel}</span>
    </div>
  );
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(m, 10) - 1]} '${year.slice(2)}`;
}

function formatAxisValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export default HistoryPage;
