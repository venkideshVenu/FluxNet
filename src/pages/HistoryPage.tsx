import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNetworkStore } from "../store/networkStore";
import { formatSpeed } from "../utils/formatSpeed";

export function HistoryPage() {
  const { history, peakUpload, peakDownload } = useNetworkStore();

  const chartData = history.map((p, i) => ({
    t: i,
    upload: +(p.upload / 1_048_576).toFixed(2),
    download: +(p.download / 1_048_576).toFixed(2),
  }));

  const maxValue = chartData.reduce(
    (max, point) => Math.max(max, point.upload, point.download),
    0,
  );
  const step =
    maxValue <= 5
      ? 1
      : maxValue <= 20
        ? 2
        : maxValue <= 50
          ? 5
          : maxValue <= 100
            ? 10
            : maxValue <= 200
              ? 20
              : maxValue <= 500
                ? 50
                : 100;
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step);

  const avgDownload = history.length
    ? history.reduce((a, p) => a + p.download, 0) / history.length
    : 0;

  const pkUp = formatSpeed(peakUpload);
  const pkDn = formatSpeed(peakDownload);
  const avgDn = formatSpeed(avgDownload);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">History</div>
          <div className="page-subtitle">
            Last {history.length} seconds of data
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Peak upload</div>
          <div className="stat-value">
            <span className="stat-num">{pkUp.value}</span>
            <span className="stat-unit">{pkUp.unit}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Peak download</div>
          <div className="stat-value">
            <span className="stat-num">{pkDn.value}</span>
            <span className="stat-unit">{pkDn.unit}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg download</div>
          <div className="stat-value">
            <span className="stat-num">{avgDn.value}</span>
            <span className="stat-unit">{avgDn.unit}</span>
          </div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-section-title">
          Upload & Download — full history
        </div>
        <div className="chart-card">
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">〜</div>
              <div className="empty-state-text">
                No history yet. Data accumulates while FluxNet runs.
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="hUp" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#22C97A"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#22C97A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hDn" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#4FBBF7"
                        stopOpacity={0.12}
                      />
                      <stop offset="95%" stopColor="#4FBBF7" stopOpacity={0} />
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
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #ECEAF8",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(val, name) =>
                      typeof val === "number"
                        ? [
                            `${val} MB/s`,
                            name === "upload" ? "Upload" : "Download",
                          ]
                        : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stroke="#22C97A"
                    strokeWidth={2}
                    fill="url(#hUp)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    stroke="#4FBBF7"
                    strokeWidth={2}
                    fill="url(#hDn)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{ background: "#22C97A" }}
                  />
                  Upload
                </div>
                <div className="legend-item">
                  <div
                    className="legend-dot"
                    style={{ background: "#4FBBF7" }}
                  />
                  Download
                </div>
                <span
                  style={{ marginLeft: "auto", fontSize: 10, color: "#C8C5F5" }}
                >
                  MB/s
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
