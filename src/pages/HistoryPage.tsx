import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
import { formatBytes, formatSpeed } from "@/utils";
import { StatCard, ChartCard, EmptyMessage } from "@/components";
import type {
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "@/types";

type Tab = "hourly" | "daily" | "monthly";

/** Joins a { value, unit } result into a single display string */
function formatDisplay(result: { value: string; unit: string }): string {
  return `${result.value} ${result.unit}`;
}

function makeTooltipFormatter(unit: string) {
  return (value: number, name: string) =>
    typeof value === "number"
      ? [
          `${value.toFixed(2)} ${unit}`,
          name === "upload" ? "Upload" : "Download",
        ]
      : null;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--text)",
};

export function HistoryPage() {
  const [tab, setTab] = useState<Tab>("daily");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [hourly, setHourly] = useState<HourlyUsage[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, []);

  const hourlyChart = useMemo(
    () =>
      [...hourly]
        .sort((left, right) => left.hourStart - right.hourStart)
        .map((point) => ({
          label: new Date(point.hourStart * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          download: point.avgDownloadBps / 1_000_000,
          upload: point.avgUploadBps / 1_000_000,
        })),
    [hourly],
  );

  const dailyChart = useMemo(
    () =>
      [...daily]
        .sort((left, right) => left.day.localeCompare(right.day))
        .map((point) => ({
          label: point.day.slice(5),
          download: point.totalDownloadBytes / 1_000_000_000,
          upload: point.totalUploadBytes / 1_000_000_000,
        })),
    [daily],
  );

  const sortedMonthly = useMemo(
    () =>
      [...monthly].sort((left, right) => left.month.localeCompare(right.month)),
    [monthly],
  );

  const monthlyChart = useMemo(
    () =>
      sortedMonthly.map((point) => ({
        label: point.month,
        download: point.totalDownloadBytes / 1_000_000_000,
        upload: point.totalUploadBytes / 1_000_000_000,
      })),
    [sortedMonthly],
  );

  const summaryCards = useMemo(
    () =>
      stats
        ? [
            {
              label: "Downloaded today",
              value: formatDisplay(formatBytes(stats.todayDownloadBytes)),
            },
            {
              label: "Uploaded today",
              value: formatDisplay(formatBytes(stats.todayUploadBytes)),
            },
            {
              label: "This week",
              value: formatDisplay(formatBytes(stats.weekDownloadBytes)),
              sub: "↓",
            },
            {
              label: "This month",
              value: formatDisplay(formatBytes(stats.monthDownloadBytes)),
              sub: "↓",
            },
          ]
        : [],
    [stats],
  );

  // Monthly data sorted by "YYYY-MM" — lexicographic = chronological
  const currentMonthly = sortedMonthly.at(-1) ?? null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "hourly", label: "Last 48 h" },
    { id: "daily", label: "Last 30 days" },
    { id: "monthly", label: "Monthly" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">History</div>
          <div className="page-subtitle">
            Historical usage, peaks, and aggregate summaries
          </div>
        </div>
      </div>

      {initialLoad && (
        <div
          className="page-subtitle"
          style={{ padding: "40px 0", textAlign: "center" }}
        >
          Loading history…
        </div>
      )}

      {error && !initialLoad && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">⚠️ {error}</span>
        </div>
      )}

      {!initialLoad && !error && (
        <>
          {stats && (
            <div
              className="stat-grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  sub={card.sub}
                />
              ))}
            </div>
          )}

          <div className="iface-chips" style={{ marginBottom: 20 }}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`iface-chip ${tab === item.id ? "active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "hourly" && (
            <ChartCard title="Average speed (MB/s)" subtitle="Last 48 hours">
              {hourlyChart.length === 0 ? (
                <EmptyMessage text="No hourly history yet. Data appears once storage summaries are available." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={hourlyChart}>
                    <defs>
                      <linearGradient
                        id="historyHourlyDown"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--net-download)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--net-download)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="historyHourlyUp"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--net-upload)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--net-upload)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => Number(value).toFixed(0)}
                      width={36}
                    />
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--text-muted)" }}
                      itemStyle={{ color: "var(--text)" }}
                      formatter={makeTooltipFormatter("MB/s") as any}
                    />
                    <Area
                      type="monotone"
                      dataKey="download"
                      stroke="var(--net-download)"
                      strokeWidth={2}
                      fill="url(#historyHourlyDown)"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      stroke="var(--net-upload)"
                      strokeWidth={2}
                      fill="url(#historyHourlyUp)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          )}

          {tab === "daily" && (
            <ChartCard title="Daily data usage (GB)" subtitle="Last 30 days">
              {dailyChart.length === 0 ? (
                <EmptyMessage text="No daily summaries yet." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyChart} barGap={2}>
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
                      interval={4}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => Number(value).toFixed(0)}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--text-muted)" }}
                      itemStyle={{ color: "var(--text)" }}
                      formatter={makeTooltipFormatter("GB") as any}
                    />
                    <Bar
                      dataKey="download"
                      fill="var(--net-download)"
                      radius={[3, 3, 0, 0]}
                      opacity={0.8}
                    />
                    <Bar
                      dataKey="upload"
                      fill="var(--net-upload)"
                      radius={[3, 3, 0, 0]}
                      opacity={0.8}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          )}

          {tab === "monthly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                className="stat-grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <StatCard
                  label="Latest month ↓"
                  value={
                    currentMonthly
                      ? formatDisplay(
                          formatBytes(currentMonthly.totalDownloadBytes),
                        )
                      : "—"
                  }
                />
                <StatCard
                  label="Latest month ↑"
                  value={
                    currentMonthly
                      ? formatDisplay(
                          formatBytes(currentMonthly.totalUploadBytes),
                        )
                      : "—"
                  }
                />
                <StatCard
                  label="Peak download"
                  value={
                    stats
                      ? formatDisplay(formatSpeed(stats.peakDownloadBps))
                      : "—"
                  }
                />
                <StatCard
                  label="Peak upload"
                  value={
                    stats
                      ? formatDisplay(formatSpeed(stats.peakUploadBps))
                      : "—"
                  }
                />
              </div>

              <ChartCard
                title="Monthly usage (GB)"
                subtitle="Historical totals by month"
              >
                {monthlyChart.length === 0 ? (
                  <EmptyMessage text="No monthly summaries yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyChart} barGap={2}>
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
                        tickFormatter={(value) => Number(value).toFixed(0)}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "var(--text-muted)" }}
                        itemStyle={{ color: "var(--text)" }}
                        formatter={makeTooltipFormatter("GB") as any}
                      />
                      <Bar
                        dataKey="download"
                        fill="var(--net-download)"
                        radius={[3, 3, 0, 0]}
                        opacity={0.8}
                      />
                      <Bar
                        dataKey="upload"
                        fill="var(--net-upload)"
                        radius={[3, 3, 0, 0]}
                        opacity={0.8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default HistoryPage;
