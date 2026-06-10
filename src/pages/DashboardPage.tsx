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

  // Determine adaptive chart unit based on max raw value
  const maxRawValue = useMemo(
    () =>
      history.reduce(
        (max, point) => Math.max(max, point.upload, point.download),
        0,
      ),
    [history],
  );

  const { divisor: chartDivisor, unitLabel: chartUnitLabel } = useMemo(
    () => getAdaptiveChartUnit(maxRawValue),
    [maxRawValue],
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

  // Connection status label
  const connectionLabel = useMemo(() => {
    if (!data.interfaceName) return "No interface";
    if (!isConnected) return "No signal";
    return "Live";
  }, [data.interfaceName, isConnected]);

  if (!isInitialized) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-subtitle">Connecting to network monitor…</div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Download</div>
            <div className="stat-value">
              <span className="stat-num">—</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upload</div>
            <div className="stat-value">
              <span className="stat-num">—</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Peak ↓</div>
            <div className="stat-value">
              <span className="stat-num">—</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Peak ↑</div>
            <div className="stat-value">
              <span className="stat-num">—</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {data.interfaceName || "—"} · updating every {intervalLabel}
          </div>
        </div>
        <span className={`live-badge ${!isConnected ? "disconnected" : ""}`}>
          <span className={`live-dot ${!isConnected ? "dead" : ""}`} />
          {connectionLabel}
        </span>
      </div>

      {lastError && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">
            ⚠️ Monitoring error: {lastError}
          </span>
          <button
            type="button"
            className="error-banner-dismiss"
            onClick={dismissError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {isFirstRun && hasNoInterface && (
        <div className="first-run-banner">
          <span className="first-run-banner-icon">👋</span>
          <div className="first-run-banner-text">
            <strong>Welcome to FluxNet!</strong>
            Select a network interface to begin monitoring your bandwidth.
          </div>
          <button
            type="button"
            className="first-run-banner-action"
            onClick={() => navigate("/interfaces")}
          >
            Select Interface
          </button>
        </div>
      )}

      {/* Stat cards — 4 columns now */}
      <div
        className="stat-grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        <div className="stat-card">
          <div className="stat-label">Download</div>
          <div className="stat-value">
            <span className="stat-num">{dn.value}</span>
            <span className="stat-unit">{dn.unit}</span>
          </div>
          <span className="stat-badge down">↓ Live</span>
        </div>

        <div className="stat-card">
          <div className="stat-label">Upload</div>
          <div className="stat-value">
            <span className="stat-num">{up.value}</span>
            <span className="stat-unit">{up.unit}</span>
          </div>
          <span className="stat-badge up">↑ Live</span>
        </div>

        <div className="stat-card">
          <div className="stat-label">Peak Download</div>
          <div className="stat-value">
            <span className="stat-num">{pkDl.value}</span>
            <span className="stat-unit">{pkDl.unit}</span>
          </div>
          <span className="stat-badge peak">↓ Session</span>
        </div>

        <div className="stat-card">
          <div className="stat-label">Peak Upload</div>
          <div className="stat-value">
            <span className="stat-num">{pkUl.value}</span>
            <span className="stat-unit">{pkUl.unit}</span>
          </div>
          <span className="stat-badge peak">↑ Session</span>
        </div>
      </div>

      {/* Chart with adaptive units */}
      <div className="chart-section">
        <div className="chart-section-title">
          Bandwidth history — last {history.length} samples
        </div>
        <div className="chart-card">
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

          <div className="chart-legend">
            <div className="legend-item">
              <div
                className="legend-dot"
                style={{ background: "var(--net-upload)" }}
              />
              Upload
            </div>
            <div className="legend-item">
              <div
                className="legend-dot"
                style={{ background: "var(--net-download)" }}
              />
              Download
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              {chartUnitLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
