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

type Tab = "hourly" | "daily" | "monthly";

/** Joins a { value, unit } result into a single display string */
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

export function HistoryPage() {
  const [tab, setTab] = useState<Tab>("daily");
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [hourly, setHourly] = useState<HourlyUsage[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayUnits = useSettingsStore((s) => s.displayUnits);

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

  // ─── Hourly chart: total bytes transferred per hour ─────────────────────────
  const hourlyChart = useMemo(() => {
    const sorted = [...hourly].sort((a, b) => a.hourStart - b.hourStart);
    return sorted.map((point) => ({
      label: new Date(point.hourStart * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      fullLabel: new Date(point.hourStart * 1000).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      downloadRaw: point.totalDownloadBytes,
      uploadRaw: point.totalUploadBytes,
    }));
  }, [hourly]);

  // Adaptive unit for hourly chart
  const hourlyMaxBytes = useMemo(
    () =>
      hourlyChart.reduce(
        (max, p) => Math.max(max, p.downloadRaw, p.uploadRaw),
        0,
      ),
    [hourlyChart],
  );
  const hourlyUnit = useMemo(
    () => getAdaptiveBytesUnit(hourlyMaxBytes),
    [hourlyMaxBytes],
  );
  const hourlyChartData = useMemo(
    () =>
      hourlyChart.map((p) => ({
        ...p,
        download: +(p.downloadRaw / hourlyUnit.divisor).toFixed(2),
        upload: +(p.uploadRaw / hourlyUnit.divisor).toFixed(2),
      })),
    [hourlyChart, hourlyUnit.divisor],
  );

  // ─── Daily chart: total bytes per day ───────────────────────────────────────
  const dailyChart = useMemo(() => {
    const sorted = [...daily].sort((a, b) => a.day.localeCompare(b.day));
    return sorted.map((point) => ({
      label: formatDayLabel(point.day),
      fullLabel: point.day,
      downloadRaw: point.totalDownloadBytes,
      uploadRaw: point.totalUploadBytes,
    }));
  }, [daily]);

  const dailyMaxBytes = useMemo(
    () =>
      dailyChart.reduce(
        (max, p) => Math.max(max, p.downloadRaw, p.uploadRaw),
        0,
      ),
    [dailyChart],
  );
  const dailyUnit = useMemo(
    () => getAdaptiveBytesUnit(dailyMaxBytes),
    [dailyMaxBytes],
  );
  const dailyChartData = useMemo(
    () =>
      dailyChart.map((p) => ({
        ...p,
        download: +(p.downloadRaw / dailyUnit.divisor).toFixed(2),
        upload: +(p.uploadRaw / dailyUnit.divisor).toFixed(2),
      })),
    [dailyChart, dailyUnit.divisor],
  );

  // ─── Monthly chart: total bytes per month ───────────────────────────────────
  const sortedMonthly = useMemo(
    () => [...monthly].sort((a, b) => a.month.localeCompare(b.month)),
    [monthly],
  );

  const monthlyChart = useMemo(() => {
    return sortedMonthly.map((point) => ({
      label: formatMonthLabel(point.month),
      fullLabel: point.month,
      downloadRaw: point.totalDownloadBytes,
      uploadRaw: point.totalUploadBytes,
    }));
  }, [sortedMonthly]);

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

  // ─── Summary cards ──────────────────────────────────────────────────────────
  const summaryCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Today ↓",
        value: fmt(formatBytes(stats.todayDownloadBytes)),
      },
      {
        label: "Today ↑",
        value: fmt(formatBytes(stats.todayUploadBytes)),
      },
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
    { id: "hourly", label: "Last 48 hours" },
    { id: "daily", label: "Last 30 days" },
    { id: "monthly", label: "Monthly" },
  ];

  // ─── Shared tooltip formatter factories ─────────────────────────────────────
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
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">History</div>
          <div className="page-subtitle">
            Bandwidth usage over time — total data transferred per period
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
          {/* Summary stats */}
          {stats && (
            <div
              className="stat-grid"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
              }}
            >
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                />
              ))}
            </div>
          )}

          {/* Tab selector */}
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

          {/* ═══════ HOURLY TAB ═══════ */}
          {tab === "hourly" && (
            <div className="chart-section">
              <div className="chart-section-title">
                Data transferred per hour ({hourlyUnit.unitLabel})
              </div>
              <div className="chart-card">
                {hourlyChartData.length === 0 ? (
                  <EmptyMessage text="No hourly data yet. Data appears after the first completed hour of monitoring." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={hourlyChartData}
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
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval="equidistantPreserveStart"
                          angle={-45}
                          textAnchor="end"
                          height={50}
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
                          labelFormatter={(_, payload) => {
                            const p = payload?.[0]?.payload;
                            return p?.fullLabel ?? "";
                          }}
                          formatter={makeFormatter(hourlyUnit.unitLabel)}
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
                    <ChartLegend unitLabel={hourlyUnit.unitLabel} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══════ DAILY TAB ═══════ */}
          {tab === "daily" && (
            <div className="chart-section">
              <div className="chart-section-title">
                Data transferred per day ({dailyUnit.unitLabel})
              </div>
              <div className="chart-card">
                {dailyChartData.length === 0 ? (
                  <EmptyMessage text="No daily data yet. Data appears after the first full day of monitoring." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={dailyChartData}
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
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={Math.max(
                            0,
                            Math.floor(dailyChartData.length / 8) - 1,
                          )}
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
                          labelFormatter={(_, payload) => {
                            const p = payload?.[0]?.payload;
                            return p?.fullLabel ?? "";
                          }}
                          formatter={makeFormatter(dailyUnit.unitLabel)}
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
                    <ChartLegend unitLabel={dailyUnit.unitLabel} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══════ MONTHLY TAB ═══════ */}
          {tab === "monthly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Monthly summary cards */}
              <div
                className="stat-grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                }}
              >
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

              <div className="chart-section">
                <div className="chart-section-title">
                  Total data per month ({monthlyUnit.unitLabel})
                </div>
                <div className="chart-card">
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
                            labelFormatter={(_, payload) => {
                              const p = payload?.[0]?.payload;
                              return p?.fullLabel ?? "";
                            }}
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

// ─── Helper Components ────────────────────────────────────────────────────────

function ChartLegend({ unitLabel }: { unitLabel: string }) {
  return (
    <div className="chart-legend">
      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ background: "var(--net-download)" }}
        />
        Downloaded
      </div>
      <div className="legend-item">
        <div
          className="legend-dot"
          style={{ background: "var(--net-upload)" }}
        />
        Uploaded
      </div>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--text-muted)",
        }}
      >
        {unitLabel}
      </span>
    </div>
  );
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/** Format "2025-01-15" into "Jan 15" */
function formatDayLabel(day: string): string {
  const [, month, dayNum] = day.split("-");
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
  const m = parseInt(month, 10) - 1;
  return `${months[m]} ${parseInt(dayNum, 10)}`;
}

/** Format "2025-01" into "Jan '25" */
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
  const mi = parseInt(m, 10) - 1;
  return `${months[mi]} '${year.slice(2)}`;
}

/** Compact Y-axis value formatter */
function formatAxisValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export default HistoryPage;
