import { useMemo } from "react";
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
import { formatSpeed, computeChartScale } from "@/utils";

export function DashboardPage() {
  const { data, isConnected, isInitialized, peakDownload, history } =
    useNetworkStore();

  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);
  const pk = formatSpeed(peakDownload);

  const chartData = useMemo(
    () =>
      history.map((p, i) => ({
        t: i,
        upload: +(p.upload / 1_048_576).toFixed(2),
        download: +(p.download / 1_048_576).toFixed(2),
      })),
    [history],
  );

  const maxValue = useMemo(
    () =>
      chartData.reduce(
        (max, point) => Math.max(max, point.upload, point.download),
        0,
      ),
    [chartData],
  );

  const { yMax, precision } = useMemo(
    () => computeChartScale(maxValue),
    [maxValue],
  );

  const intervalLabel = `${pollIntervalMs / 1000}s`;

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
            <div className="stat-label">Peak today</div>
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
        <span className="live-badge">
          <span className="live-dot" />
          {isConnected ? "Live" : "No signal"}
        </span>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
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
          <div className="stat-label">Peak today</div>
          <div className="stat-value">
            <span className="stat-num">{pk.value}</span>
            <span className="stat-unit">{pk.unit}</span>
          </div>
          <span className="stat-badge peak">↓ Download</span>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-section">
        <div className="chart-section-title">
          Bandwidth history — last {history.length}s
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
                stroke="#ECEAF8"
                vertical={false}
              />
              <XAxis dataKey="t" hide />
              <YAxis
                tick={{ fontSize: 10, fill: "#C8C5F5" }}
                axisLine={false}
                tickLine={false}
                width={32}
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
                  `${val ?? 0} MB/s`,
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
              style={{ marginLeft: "auto", fontSize: 10, color: "#C8C5F5" }}
            >
              MB/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
