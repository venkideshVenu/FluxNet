import { useNetworkStore } from "@/store";
import { formatSpeed } from "@/utils";
import { useMemo, useRef } from "react";

/** Formats a timestamp as a relative "Xs ago" / "Xm ago" string */
function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function AlertsPage() {
  const { peakUpload, peakDownload, isConnected, history } = useNetworkStore();

  // Track when the session started for timestamp context
  const sessionStartRef = useRef(Date.now());

  const alerts = useMemo(() => {
    const now = Date.now();
    const list: {
      type: "warn" | "error" | "info";
      title: string;
      body: string;
      time: string;
    }[] = [];

    if (!isConnected) {
      list.push({
        type: "error",
        title: "Interface disconnected",
        body: "FluxNet lost contact with the network interface. Check your connection.",
        time: formatRelativeTime(now),
      });
    }

    // Spike detection: last reading > 90% of peak
    const last = history[history.length - 1];
    if (last) {
      if (peakDownload > 0 && last.download > peakDownload * 0.9) {
        const sp = formatSpeed(last.download);
        list.push({
          type: "warn",
          title: "Download spike",
          body: `Download hit ${sp.value} ${sp.unit} — near session peak.`,
          time: formatRelativeTime(now),
        });
      }

      if (peakUpload > 0 && last.upload > peakUpload * 0.9) {
        const sp = formatSpeed(last.upload);
        list.push({
          type: "warn",
          title: "Upload spike",
          body: `Upload hit ${sp.value} ${sp.unit} — near session peak.`,
          time: formatRelativeTime(now),
        });
      }
    }

    if (list.length === 0) {
      list.push({
        type: "info",
        title: "All clear",
        body: "No alerts this session. FluxNet is monitoring normally.",
        time: `Session started ${formatRelativeTime(sessionStartRef.current)}`,
      });
    }

    return list;
  }, [peakUpload, peakDownload, isConnected, history]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-subtitle">
            Session notifications and anomalies
          </div>
        </div>
      </div>

      <div className="alert-list">
        {alerts.map((a, i) => (
          <div key={i} className={`alert-card ${a.type}`}>
            <div className="alert-title">{a.title}</div>
            <div className="alert-body">{a.body}</div>
            <div className="alert-time">{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
