import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import { formatBytes, formatSpeed } from "../utils/formatSpeed";
import {
  getStoredCompactIntervalMs,
  LS_COMPACT_INTERVAL,
} from "../utils/polling";

export function CompactWidget() {
  const { data, isConnected, todayDownloadBytes, todayUploadBytes } =
    useNetworkStore();
  const [intervalMs, setIntervalMs] = useState(() =>
    getStoredCompactIntervalMs(),
  );

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);
  const upToday = formatBytes(todayUploadBytes);
  const dnToday = formatBytes(todayDownloadBytes);

  const handleDrag = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".cw-drag-handle")) return;
    handleDrag(e);
  };

  useEffect(() => {
    const sync = () => setIntervalMs(getStoredCompactIntervalMs());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_COMPACT_INTERVAL) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const intervalLabel = `${intervalMs / 1000}s`;

  return (
    <div className="cw-root" role="status">
      {/* ── Header ── */}
      <div className="cw-header" onMouseDown={handleHeaderMouseDown}>
        <span className="cw-brand">FluxNet</span>
        <div
          className="cw-drag-handle"
          title="Drag to move"
          aria-hidden="true"
        />
      </div>

      {/* ── Status row ── */}
      <div className="cw-status-row">
        <div className="cw-iface">
          <span className="cw-iface-name">{data.interfaceName || "—"}</span>
          <span className="cw-iface-sub">
            {isConnected ? "Connected" : "No signal"}
          </span>
        </div>
        <div className="cw-status-right">
          <span className="cw-status-pill">
            <span className={`cw-live-dot ${isConnected ? "live" : "dead"}`} />
            {isConnected ? "Live" : "Offline"}
          </span>
          <span className="cw-interval">{intervalLabel}</span>
        </div>
      </div>

      <div className="cw-divider" aria-hidden="true" />

      {/* ── Speed rows ── */}
      <div className="cw-speeds">
        <div className="cw-speed-row">
          <span className="cw-speed-label">
            <span className="cw-dir dn" aria-hidden="true" />
            Download
          </span>
          <span className="cw-speed-value">
            <span className="cw-num">{dn.value}</span>
            <span className="cw-unit">{dn.unit}</span>
          </span>
        </div>
        <div className="cw-speed-row">
          <span className="cw-speed-label">
            <span className="cw-dir up" aria-hidden="true" />
            Upload
          </span>
          <span className="cw-speed-value">
            <span className="cw-num">{up.value}</span>
            <span className="cw-unit">{up.unit}</span>
          </span>
        </div>
      </div>

      <div className="cw-divider" aria-hidden="true" />

      {/* ── Today totals ── */}
      <div className="cw-today-row">
        <span className="cw-today-label">Today</span>
        <span className="cw-today-values">
          <span className="cw-today-item">
            <span className="cw-dir dn" aria-hidden="true" />
            <span className="cw-today-num">{dnToday.value}</span>
            <span className="cw-today-unit">{dnToday.unit}</span>
          </span>
          <span className="cw-today-item">
            <span className="cw-dir up" aria-hidden="true" />
            <span className="cw-today-num">{upToday.value}</span>
            <span className="cw-today-unit">{upToday.unit}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
