import { useNetworkStore } from "../store/networkStore";
import { formatSpeed } from "../utils/formatSpeed";
import { useMemo } from "react";

export function AlertsPage() {
  const { peakUpload, peakDownload, isConnected, history } = useNetworkStore();

  const alerts = useMemo(() => {
    const list: { type: "warn" | "error" | "info"; title: string; body: string; time: string }[] = [];

    if (!isConnected) {
      list.push({
        type: "error",
        title: "Interface disconnected",
        body: "FluxNet lost contact with the network interface. Check your connection.",
        time: "just now",
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
          time: "just now",
        });
      }
    }

    if (list.length === 0) {
      list.push({
        type: "info",
        title: "All clear",
        body: "No alerts this session. FluxNet is monitoring normally.",
        time: "now",
      });
    }

    return list;
  }, [peakUpload, peakDownload, isConnected, history]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Alerts</div>
          <div className="page-subtitle">Session notifications and anomalies</div>
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