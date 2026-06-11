import { useNetworkStore } from "@/store";
import { formatSpeed } from "@/utils";
import { useMemo, useRef } from "react";

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

  const borderColor = (type: string) => {
    if (type === "warn") return "border-l-warning";
    if (type === "error") return "border-l-danger";
    return "border-l-accent";
  };

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-[5px]">
            Alerts
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Session notifications and anomalies
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={`bg-panel border border-border border-l-[3px] ${borderColor(a.type)} rounded-[10px] px-4 py-3`}
          >
            <div className="text-[13px] font-medium text-text mb-[3px]">
              {a.title}
            </div>
            <div className="text-[11px] text-text-muted">{a.body}</div>
            <div className="text-[10px] text-accent-border mt-1">{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
