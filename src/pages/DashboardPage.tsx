import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNetworkStore } from "@/store";
import { useSettingsStore } from "@/store";
import {
  formatSpeed,
  getAdaptiveChartUnit,
  computeChartScale,
  getStorageItem,
} from "@/utils";

export function DashboardPage() {
  const {
    data,
    isConnected,
    isInitialized,
    lastError,
    peakDownload,
    peakUpload,
    history,
    dismissError,
  } = useNetworkStore();

  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const navigate = useNavigate();

  const up = formatSpeed(data.uploadBytesPerSec, displayUnits);
  const dn = formatSpeed(data.downloadBytesPerSec, displayUnits);
  const pkDl = formatSpeed(peakDownload, displayUnits);
  const pkUl = formatSpeed(peakUpload, displayUnits);

  const maxRawValue = useMemo(
    () =>
      history.reduce(
        (max, point) => Math.max(max, point.upload, point.download),
        0,
      ),
    [history],
  );

  const { divisor: chartDivisor, unitLabel: chartUnitLabel } = useMemo(
    () => getAdaptiveChartUnit(maxRawValue, displayUnits),
    [maxRawValue, displayUnits],
  );

  const chartData = useMemo(
    () =>
      history.map((p, i) => ({
        t: i,
        upload: +(p.upload / chartDivisor).toFixed(2),
        download: +(p.download / chartDivisor).toFixed(2),
      })),
    [history, chartDivisor],
  );

  const maxChartValue = useMemo(
    () =>
      chartData.reduce(
        (max, point) => Math.max(max, point.upload, point.download),
        0,
      ),
    [chartData],
  );

  const { yMax, precision } = useMemo(
    () => computeChartScale(maxChartValue),
    [maxChartValue],
  );

  const intervalLabel = `${pollIntervalMs / 1000}s`;
  const isFirstRun = !getStorageItem("fluxnet_configured", "");
  const hasNoInterface = !data.interfaceName;

  const connectionLabel = useMemo(() => {
    if (!data.interfaceName) return "No interface";
    if (!isConnected) return "No signal";
    return "Live";
  }, [data.interfaceName, isConnected]);

  if (!isInitialized) {
    return (
      <div className="p-7 px-8 w-full max-w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
              Dashboard
            </div>
            <div className="text-[12px] text-text-muted font-normal">
              Connecting to network monitor…
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {["Download", "Upload", "Peak ↓", "Peak ↑"].map((label) => (
            <div
              key={label}
              className="bg-panel border border-border rounded-lg px-4.5 py-4"
            >
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
                {label}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
                  —
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
            Dashboard
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            {data.interfaceName || "—"} · updating every {intervalLabel}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-[20px] px-2.5 py-1 ${
            !isConnected
              ? "bg-danger-bg text-danger-text"
              : "text-net-upload bg-success-bg"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !isConnected ? "bg-danger" : "bg-net-upload animate-pulse"
            }`}
          />
          {connectionLabel}
        </span>
      </div>

      {lastError && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 bg-danger-bg border border-danger-border rounded-md text-danger-text text-[12px] mb-4"
          role="alert"
        >
          <span className="flex-1">⚠️ Monitoring error: {lastError}</span>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss error"
            className="bg-transparent border-none text-danger-text cursor-pointer text-base px-1 leading-none"
          >
            ×
          </button>
        </div>
      )}

      {isFirstRun && hasNoInterface && (
        <div className="flex items-center gap-3 px-4.5 py-3.5 bg-accent-soft border border-accent-border rounded-lg mb-4">
          <span className="text-xl shrink-0">👋</span>
          <div className="flex-1 text-[13px] text-text">
            <strong className="block mb-0.5 text-sm">
              Welcome to FluxNet!
            </strong>
            Select a network interface to begin monitoring your bandwidth.
          </div>
          <button
            type="button"
            onClick={() => navigate("/interfaces")}
            className="bg-accent text-white border-none rounded-sm px-3.5 py-1.5 text-[12px] font-medium cursor-pointer whitespace-nowrap hover:opacity-90"
          >
            Select Interface
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-panel border border-border rounded-lg px-4.5 py-4 transition-shadow hover:shadow-[0_2px_12px_rgba(124,111,247,0.08)]">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Download
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {dn.value}
            </span>
            <span className="text-[12px] text-text-muted">{dn.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-medium rounded-[20px] px-1.75 py-0.5 bg-accent-soft text-net-download">
            ↓ Live
          </span>
        </div>

        <div className="bg-panel border border-border rounded-lg px-4.5 py-4 transition-shadow hover:shadow-[0_2px_12px_rgba(124,111,247,0.08)]">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Upload
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {up.value}
            </span>
            <span className="text-[12px] text-text-muted">{up.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-medium rounded-[20px] px-1.75 py-0.5 bg-success-bg text-net-upload">
            ↑ Live
          </span>
        </div>

        <div className="bg-panel border border-border rounded-lg px-4.5 py-4 transition-shadow hover:shadow-[0_2px_12px_rgba(124,111,247,0.08)]">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Peak Download
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {pkDl.value}
            </span>
            <span className="text-[12px] text-text-muted">{pkDl.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-medium rounded-[20px] px-1.75 py-0.5 bg-accent-soft-2 text-accent-strong">
            ↓ Session
          </span>
        </div>

        <div className="bg-panel border border-border rounded-lg px-4.5 py-4 transition-shadow hover:shadow-[0_2px_12px_rgba(124,111,247,0.08)]">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Peak Upload
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {pkUl.value}
            </span>
            <span className="text-[12px] text-text-muted">{pkUl.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-medium rounded-[20px] px-1.75 py-0.5 bg-accent-soft-2 text-accent-strong">
            ↑ Session
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
          Bandwidth history — last {history.length} samples
        </div>
        <div className="bg-panel border border-border rounded-lg p-5">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--net-upload)"
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--net-upload)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorDn" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--net-download)"
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--net-download)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={38}
                domain={[0, yMax]}
                tickCount={5}
                tickFormatter={(v) => Number(v).toFixed(precision)}
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
                cursor={{ stroke: "var(--accent-border)", strokeWidth: 1 }}
                formatter={(val, name) => [
                  `${val ?? 0} ${chartUnitLabel}`,
                  name === "upload" ? "Upload" : "Download",
                ]}
              />
              <Area
                type="monotone"
                dataKey="upload"
                stroke="var(--net-upload)"
                strokeWidth={2}
                fill="url(#colorUp)"
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="download"
                stroke="var(--net-download)"
                strokeWidth={2}
                fill="url(#colorDn)"
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-text-subtle">
              <div className="w-2 h-2 rounded-full bg-net-upload" />
              Upload
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-subtle">
              <div className="w-2 h-2 rounded-full bg-net-download" />
              Download
            </div>
            <span className="ml-auto text-[10px] text-text-muted">
              {chartUnitLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
