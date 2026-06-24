import { useMemo, useState, useRef, useCallback } from "react";
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
import { useNetworkStore, useSettingsStore } from "@/store";
import {
  formatSpeed,
  getAdaptiveChartUnit,
  computeChartScale,
  getStorageItem,
} from "@/utils";

const DEFAULT_VISIBLE_POINTS = 200;

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
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const navigate = useNavigate();

  const [chartOffset, setChartOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; offset: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const up = formatSpeed(data.uploadBytesPerSec, displayUnits);
  const dn = formatSpeed(data.downloadBytesPerSec, displayUnits);
  const pkDl = formatSpeed(peakDownload, displayUnits);
  const pkUl = formatSpeed(peakUpload, displayUnits);

  const totalPoints = history.length;
  const maxOffset = Math.max(0, totalPoints - DEFAULT_VISIBLE_POINTS);
  const clampedOffset = Math.min(chartOffset, maxOffset);

  const visibleHistory = useMemo(() => {
    const end = totalPoints - clampedOffset;
    const start = Math.max(0, end - DEFAULT_VISIBLE_POINTS);
    return history.slice(start, end);
  }, [history, totalPoints, clampedOffset]);

  const isAtLatest = clampedOffset === 0;

  const maxRawValue = useMemo(
    () =>
      visibleHistory.reduce(
        (max, point) => Math.max(max, point.upload, point.download),
        0,
      ),
    [visibleHistory],
  );

  const { divisor: chartDivisor, unitLabel: chartUnitLabel } = useMemo(
    () => getAdaptiveChartUnit(maxRawValue, displayUnits),
    [maxRawValue, displayUnits],
  );

  const formatTime = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      if (timeFormat === "24h") {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      }
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    },
    [timeFormat],
  );

  const chartData = useMemo(
    () =>
      visibleHistory.map((p) => ({
        t: p.t,
        timeLabel: formatTime(p.t),
        upload: +(p.upload / chartDivisor).toFixed(2),
        download: +(p.download / chartDivisor).toFixed(2),
      })),
    [visibleHistory, chartDivisor, formatTime],
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (totalPoints <= DEFAULT_VISIBLE_POINTS) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, offset: clampedOffset };
    },
    [totalPoints, clampedOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const container = chartContainerRef.current;
      if (!container) return;
      const dx = e.clientX - dragStartRef.current.x;
      const containerWidth = container.clientWidth;
      const pointsPerPixel = DEFAULT_VISIBLE_POINTS / containerWidth;
      const pointsDelta = Math.round(dx * pointsPerPixel);
      const newOffset = Math.max(
        0,
        Math.min(maxOffset, dragStartRef.current.offset + pointsDelta),
      );
      setChartOffset(newOffset);
    },
    [isDragging, maxOffset],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (totalPoints <= DEFAULT_VISIBLE_POINTS) return;
      e.preventDefault();
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const step = Math.max(1, Math.round(Math.abs(delta) / 10));
      const direction = delta > 0 ? -step : step;
      setChartOffset((prev) =>
        Math.max(0, Math.min(maxOffset, prev + direction)),
      );
    },
    [totalPoints, maxOffset],
  );

  const jumpToLatest = useCallback(() => setChartOffset(0), []);

  const intervalLabel = `${pollIntervalMs / 1000}s`;
  const isFirstRun = !getStorageItem("fluxnet_configured", "");
  const hasNoInterface = !data.interfaceName;

  const connectionLabel = useMemo(() => {
    if (!data.interfaceName) return "No interface";
    if (!isConnected) return "No signal";
    return "Live";
  }, [data.interfaceName, isConnected]);

  // Determine chart cursor style
  const chartCursorClass =
    totalPoints > DEFAULT_VISIBLE_POINTS
      ? isDragging
        ? "cursor-grabbing"
        : "cursor-grab"
      : "cursor-pointer";

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
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-[20px] px-2.5 py-1 ${!isConnected ? "bg-danger-bg text-danger-text" : "bg-[rgba(34,209,96,0.15)] text-[#2ee67a]"}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${!isConnected ? "bg-danger" : "bg-[#2ee67a] animate-pulse"}`}
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
        <div className="bg-panel border border-border rounded-lg px-4.5 py-4">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Download
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {dn.value}
            </span>
            <span className="text-[12px] text-text-muted">{dn.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold rounded-[20px] px-1.75 py-0.5 bg-[rgba(56,189,248,0.12)] text-[#38bdf8] border border-[rgba(56,189,248,0.25)]">
            ↓ Live
          </span>
        </div>
        <div className="bg-panel border border-border rounded-lg px-4.5 py-4">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Upload
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {up.value}
            </span>
            <span className="text-[12px] text-text-muted">{up.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold rounded-[20px] px-1.75 py-0.5 bg-[rgba(52,211,153,0.12)] text-[#34d399] border border-[rgba(52,211,153,0.25)]">
            ↑ Live
          </span>
        </div>
        <div className="bg-panel border border-border rounded-lg px-4.5 py-4">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Peak Download
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {pkDl.value}
            </span>
            <span className="text-[12px] text-text-muted">{pkDl.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold rounded-[20px] px-1.75 py-0.5 bg-[rgba(124,111,247,0.12)] text-[#a78bfa] border border-[rgba(124,111,247,0.25)]">
            ↓ Session
          </span>
        </div>
        <div className="bg-panel border border-border rounded-lg px-4.5 py-4">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
            Peak Upload
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
              {pkUl.value}
            </span>
            <span className="text-[12px] text-text-muted">{pkUl.unit}</span>
          </div>
          <span className="inline-flex items-center gap-0.75 text-[10px] font-semibold rounded-[20px] px-1.75 py-0.5 bg-[rgba(124,111,247,0.12)] text-[#a78bfa] border border-[rgba(124,111,247,0.25)]">
            ↑ Session
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em]">
            Bandwidth history
            {!isAtLatest && (
              <span className="ml-2 text-accent opacity-80">
                · viewing older data
              </span>
            )}
          </div>
          {!isAtLatest && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="text-[10px] font-semibold text-accent bg-accent-soft border border-accent-border rounded-full px-2.5 py-1 cursor-pointer hover:bg-accent-soft-2 transition-colors"
            >
              ← Jump to latest
            </button>
          )}
        </div>
        <div
          ref={chartContainerRef}
          className={`bg-panel border border-border rounded-lg p-5 ${chartCursorClass}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
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
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
              />
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
                labelFormatter={(label) => String(label)}
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
            {totalPoints > DEFAULT_VISIBLE_POINTS && (
              <span className="text-[10px] text-text-muted opacity-70">
                Drag or scroll to pan
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
