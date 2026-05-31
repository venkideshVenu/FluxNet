import { useEffect, useState } from "react";
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
} from "../hooks/useStorageApi";
import { formatBytes, formatSpeed } from "../utils/formatSpeed";
import type {
  DailyUsage,
  HourlyUsage,
  MonthlyUsage,
  UsageStats,
} from "../types/persistence";

type Tab = "hourly" | "daily" | "monthly";

type DisplayValue = { value: string; unit: string };

function renderValue(result: DisplayValue) {
  return `${result.value} ${result.unit}`;
}

export function HistoryPage() {
  const [tab, setTab] = useState<Tab>("daily");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [hourly, setHourly] = useState<HourlyUsage[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    }

    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const hourlyChart = [...hourly]
    .sort((left, right) => left.hourStart - right.hourStart)
    .map((point) => ({
      label: new Date(point.hourStart * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      download: point.avgDownloadBps / 1_000_000,
      upload: point.avgUploadBps / 1_000_000,
    }));

  const dailyChart = [...daily]
    .sort((left, right) => left.day.localeCompare(right.day))
    .map((point) => ({
      label: point.day.slice(5),
      download: point.totalDownloadBytes / 1_000_000_000,
      upload: point.totalUploadBytes / 1_000_000_000,
    }));

  const sortedMonthly = [...monthly].sort((left, right) =>
    left.month.localeCompare(right.month),
  );

  const monthlyChart = sortedMonthly.map((point) => ({
    label: point.month,
    download: point.totalDownloadBytes / 1_000_000_000,
    upload: point.totalUploadBytes / 1_000_000_000,
  }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "hourly", label: "Last 48 h" },
    { id: "daily", label: "Last 30 days" },
    { id: "monthly", label: "Monthly" },
  ];

  const summaryCards = stats
    ? [
        {
          label: "Downloaded today",
          value: renderValue(formatBytes(stats.todayDownloadBytes)),
        },
        {
          label: "Uploaded today",
          value: renderValue(formatBytes(stats.todayUploadBytes)),
        },
        {
          label: "This week",
          value: renderValue(formatBytes(stats.weekDownloadBytes)),
          sub: "↓",
        },
        {
          label: "This month",
          value: renderValue(formatBytes(stats.monthDownloadBytes)),
          sub: "↓",
        },
      ]
    : [];

  const currentMonthly = sortedMonthly.length
    ? sortedMonthly[sortedMonthly.length - 1]
    : null;

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

      {loading && <div className="page-subtitle">Loading history…</div>}
      {error && (
        <div className="page-subtitle" style={{ color: "#c33" }}>
          {error}
        </div>
      )}

      {!loading && !error && tab === "hourly" && (
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
                  tick={{ fill: "#C8C5F5", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#C8C5F5", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => Number(value).toFixed(0)}
                  width={36}
                />
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ECEAF8"
                  vertical={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "var(--text)",
                  }}
                  labelStyle={{ color: "var(--text-muted)" }}
                  itemStyle={{ color: "var(--text)" }}
                  formatter={
                    ((value: any, name: any) =>
                      typeof value === "number"
                        ? [
                            `${value.toFixed(2)} MB/s`,
                            name === "upload" ? "Upload" : "Download",
                          ]
                        : null) as any
                  }
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

      {!loading && !error && tab === "daily" && (
        <ChartCard title="Daily data usage (GB)" subtitle="Last 30 days">
          {dailyChart.length === 0 ? (
            <EmptyMessage text="No daily summaries yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyChart} barGap={2}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ECEAF8"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#C8C5F5", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: "#C8C5F5", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => Number(value).toFixed(0)}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "var(--text)",
                  }}
                  labelStyle={{ color: "var(--text-muted)" }}
                  itemStyle={{ color: "var(--text)" }}
                  formatter={
                    ((value: any, name: any) =>
                      typeof value === "number"
                        ? [
                            `${value.toFixed(2)} GB`,
                            name === "upload" ? "Upload" : "Download",
                          ]
                        : null) as any
                  }
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

      {!loading && !error && tab === "monthly" && (
        <div className="space-y-4">
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
                  ? renderValue(formatBytes(currentMonthly.totalDownloadBytes))
                  : "—"
              }
            />
            <StatCard
              label="Latest month ↑"
              value={
                currentMonthly
                  ? renderValue(formatBytes(currentMonthly.totalUploadBytes))
                  : "—"
              }
            />
            <StatCard
              label="Peak download"
              value={
                stats ? renderValue(formatSpeed(stats.peakDownloadBps)) : "—"
              }
            />
            <StatCard
              label="Peak upload"
              value={
                stats ? renderValue(formatSpeed(stats.peakUploadBps)) : "—"
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
                    stroke="#ECEAF8"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#C8C5F5", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#C8C5F5", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => Number(value).toFixed(0)}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "var(--text)",
                    }}
                    labelStyle={{ color: "var(--text-muted)" }}
                    itemStyle={{ color: "var(--text)" }}
                    formatter={
                      ((value: any, name: any) =>
                        typeof value === "number"
                          ? [
                              `${value.toFixed(2)} GB`,
                              name === "upload" ? "Upload" : "Download",
                            ]
                          : null) as any
                    }
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
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label} {sub}
      </div>
      <div className="stat-value">
        <span className="stat-num">{value}</span>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chart-section">
      <div className="chart-section-title">{title}</div>
      <div className="chart-card">
        <div className="page-subtitle" style={{ marginBottom: 16 }}>
          {subtitle}
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="page-subtitle">{text}</div>;
}

export default HistoryPage;
