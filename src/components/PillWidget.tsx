import { useNetworkStore } from "../store/networkStore";
import { formatSpeed } from "../utils/formatSpeed";

export function PillWidget() {
  const { data, isConnected } = useNetworkStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  return (
    <div
      data-tauri-drag-region // makes the whole pill draggable
      className="pill-root"
      role="status"
      aria-label={`Upload ${up.value} ${up.unit}, Download ${dn.value} ${dn.unit}`}
    >
      {/* Upload */}
      <div className="pill-stat">
        <span className="pill-arrow up" aria-hidden="true">
          ↑
        </span>
        <span className="pill-value">{up.value}</span>
        <span className="pill-unit">{up.unit}</span>
      </div>

      {/* Divider */}
      <div className="pill-sep" aria-hidden="true" />

      {/* Download */}
      <div className="pill-stat">
        <span className="pill-arrow dn" aria-hidden="true">
          ↓
        </span>
        <span className="pill-value">{dn.value}</span>
        <span className="pill-unit">{dn.unit}</span>
      </div>

      {/* Live indicator dot */}
      <div
        className={`pill-live-dot ${isConnected ? "live" : "dead"}`}
        title={isConnected ? "Connected" : "No data"}
        aria-hidden="true"
      />
    </div>
  );
}
