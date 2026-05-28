import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import { formatSpeed } from "../utils/formatSpeed";

export function PillWidget() {
  const { data, isConnected } = useNetworkStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const unitClass = (unit: string) => {
    switch (unit) {
      case "GB/s":
        return "unit-gb";
      case "MB/s":
        return "unit-mb";
      case "KB/s":
        return "unit-kb";
      case "B/s":
      default:
        return "unit-b";
    }
  };

  const handleDragStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error("drag error:", err);
    }
  };

  return (
    <div
      className="pill-root"
      role="status"
      aria-label={`Download ${dn.value} ${dn.unit}, Upload ${up.value} ${up.unit}`}
    >
      {/* Download — LEFT */}
      <div className="pill-stat">
        <span className="pill-arrow dn" aria-hidden="true">
          ↓
        </span>
        <span className="pill-value">{dn.value}</span>
        <span className={`pill-unit ${unitClass(dn.unit)}`}>{dn.unit}</span>
      </div>

      <div className="pill-sep" aria-hidden="true" />

      {/* Upload — RIGHT */}
      <div className="pill-stat">
        <span className="pill-arrow up" aria-hidden="true">
          ↑
        </span>
        <span className="pill-value">{up.value}</span>
        <span className={`pill-unit ${unitClass(up.unit)}`}>{up.unit}</span>
      </div>

      {/* Push dot to far right */}

      {/* Drag dot */}
      <div
        className={`pill-live-dot ${isConnected ? "live" : "dead"}`}
        onMouseDown={handleDragStart}
        title="Drag to move"
        aria-hidden="true"
      />
    </div>
  );
}
