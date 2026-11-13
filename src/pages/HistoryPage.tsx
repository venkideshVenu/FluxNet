import { useEffect, useMemo, useState } from "react";
import { ChartColumn, Table } from "lucide-react";
import {
  fetchDailySummary,
  fetchHourlySummary,
  fetchMonthlySummary,
  fetchUsageStats,
} from "@/api";
import { formatBytes, formatSpeed } from "@/utils";
import {
  hasData,
  hourlyBuckets,
  monthlyBuckets,
  weeklyBuckets,
  type Bucket,
} from "@/utils/usageBuckets";
import { useSettingsStore } from "@/store";
import type { DailyUsage, HourlyUsage, MonthlyUsage, UsageStats } from "@/types";
import { ChartLegend, UsageChart } from "@/components/charts";
import {
  Button,
  Card,
  InfoBar,
  Page,
  PageHeader,
  ProgressRing,
  SelectorBar,
} from "@/components/fluent";

type Range = "today" | "week" | "months";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "months", label: "Last 12 months" },
];

const REFRESH_MS = 10_000;

function bytesText(v: number) {
  const r = formatBytes(v);
  return `${r.value} ${r.unit}`;
}

/** A summary cell: total, with the download/upload split underneath. */
function Total({
  label,
  download,
  upload,
}: {
  label: string;
  download: number;
  upload: number;
}) {
  return (
    <div className="min-w-[180px] flex-1 px-5 py-4 not-first:border-l not-first:border-divider">
      <div className="text-caption text-fg-secondary">{label}</div>
      <div className="mt-1 font-display text-subtitle font-semibold tabular">
        {bytesText(download + upload)}
      </div>
      <div className="mt-0.5 text-caption text-fg-secondary tabular">
        ↓ {bytesText(download)} · ↑ {bytesText(upload)}
      </div>
    </div>
  );
}

function UsageTable({ buckets }: { buckets: Bucket[] }) {
  const rows = buckets.filter((b) => !b.future);
  return (
    <div className="max-h-[320px] overflow-y-auto">
      <table className="w-full border-collapse text-body tabular">
        <thead className="sticky top-0 bg-card-solid">
          <tr className="text-left text-caption text-fg-secondary">
            <th className="py-2 pr-4 font-normal">Period</th>
            <th className="py-2 pr-4 text-right font-normal">Downloaded</th>
            <th className="py-2 pr-4 text-right font-normal">Uploaded</th>
            <th className="py-2 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody className="select-text">
          {rows.map((b) => (
            <tr key={b.key} className="border-t border-divider">
              <td className="py-1.5 pr-4">
                {b.title}
                {b.partial && <span className="text-fg-secondary"> (so far)</span>}
              </td>
              <td className="py-1.5 pr-4 text-right">{bytesText(b.download)}</td>
              <td className="py-1.5 pr-4 text-right">{bytesText(b.upload)}</td>
              <td className="py-1.5 text-right">{bytesText(b.download + b.upload)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryPage() {
  const [range, setRange] = useState<Range>("today");
  const [showTable, setShowTable] = useState(false);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [hourly, setHourly] = useState<HourlyUsage[]>([]);
  const [daily, setDaily] = useState<DailyUsage[]>([]);
  const [monthly, setMonthly] = useState<MonthlyUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const startOfWeek = useSettingsStore((s) => s.startOfWeek);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, h, d, m] = await Promise.all([
          fetchUsageStats(),
          fetchHourlySummary(48),
          fetchDailySummary(30),
          fetchMonthlySummary(),
        ]);
        if (!alive) return;
        setStats(s);
        setHourly(h);
        setDaily(d);
        setMonthly(m);
        setNow(new Date());
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    // Skip refreshes while the dashboard is hidden (minimized or in the tray).
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const buckets = useMemo(() => {
    if (range === "today") {
      return hourlyBuckets(
        hourly,
        now,
        timeFormat,
        stats
          ? { download: stats.todayDownloadBytes, upload: stats.todayUploadBytes }
          : undefined,
      );
    }
    if (range === "week") return weeklyBuckets(daily, now, startOfWeek);
    return monthlyBuckets(monthly, now, stats);
  }, [range, hourly, daily, monthly, stats, now, timeFormat, startOfWeek]);

  const peak = (v: number) => {
    const r = formatSpeed(v, displayUnits);
    return `${r.value} ${r.unit}`;
  };

  return (
    <Page wide>
      <PageHeader title="Data usage" />

      {error && !loading && (
        <InfoBar
          className="mb-4"
          severity="error"
          title="Couldn't load usage"
          message={error}
        />
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <ProgressRing label="Loading usage" />
        </div>
      ) : (
        <>
          <Card className="mb-6 flex flex-wrap">
            <Total
              label="Today"
              download={stats?.todayDownloadBytes ?? 0}
              upload={stats?.todayUploadBytes ?? 0}
            />
            <Total
              label="Last 7 days"
              download={stats?.weekDownloadBytes ?? 0}
              upload={stats?.weekUploadBytes ?? 0}
            />
            <Total
              label="This month"
              download={stats?.monthDownloadBytes ?? 0}
              upload={stats?.monthUploadBytes ?? 0}
            />
            <div className="min-w-[180px] flex-1 px-5 py-4 not-first:border-l not-first:border-divider">
              <div className="text-caption text-fg-secondary">Fastest recorded</div>
              <div className="mt-1 font-display text-subtitle font-semibold tabular">
                {peak(stats?.peakDownloadBps ?? 0)}
              </div>
              <div className="mt-0.5 text-caption text-fg-secondary tabular">
                Upload {peak(stats?.peakUploadBps ?? 0)}
              </div>
            </div>
          </Card>

          <div className="mb-2 flex items-center justify-between gap-4">
            <SelectorBar
              label="Period"
              items={RANGES}
              value={range}
              onChange={setRange}
            />
            <Button
              variant="subtle"
              icon={showTable ? <ChartColumn /> : <Table />}
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? "Show chart" : "Show table"}
            </Button>
          </div>

          <Card className="px-5 pt-4 pb-3">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-body font-semibold">
                {range === "today"
                  ? "Data used per hour"
                  : range === "week"
                    ? "Data used per day"
                    : "Data used per month"}
              </h2>
              {!showTable && (
                <ChartLegend labels={{ download: "Downloaded", upload: "Uploaded" }} />
              )}
            </div>
            {!hasData(buckets) ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-1 text-center">
                <div className="text-body">No usage recorded yet</div>
                <div className="text-caption text-fg-secondary">
                  {range === "today"
                    ? "Hours appear here as FluxNet measures your connection."
                    : range === "week"
                      ? "Days appear here as FluxNet measures your connection."
                      : "Months appear here as FluxNet measures your connection."}
                </div>
              </div>
            ) : showTable ? (
              <UsageTable buckets={buckets} />
            ) : (
              <UsageChart buckets={buckets} tickEvery={range === "today" ? 3 : 1} />
            )}
          </Card>
        </>
      )}
    </Page>
  );
}

export default HistoryPage;
