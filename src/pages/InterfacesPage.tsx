import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "../store/networkStore";

type InterfaceInfo = {
  name: string;
  description: string;
  ifIndex: number;
  status: string;
  mac: string;
  linkSpeedBps: number;
};

const formatLinkSpeed = (bps: number) => {
  if (!bps || bps <= 0) {
    return "0 bps";
  }

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let value = bps;
  let i = 0;

  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i += 1;
  }

  const rounded =
    value >= 100
      ? value.toFixed(0)
      : value >= 10
        ? value.toFixed(1)
        : value.toFixed(2);
  return `${rounded} ${units[i]}`;
};

export function InterfacesPage() {
  const { data } = useNetworkStore();
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    invoke<InterfaceInfo[]>("get_interfaces")
      .then(setInterfaces)
      .catch(console.error);
  }, []);

  const select = async (name: string) => {
    setSelecting(name);
    try {
      await invoke("set_interface", { name });
    } catch (e) {
      console.error(e);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Interfaces</div>
          <div className="page-subtitle">
            Currently monitoring: <strong>{data.interfaceName || "—"}</strong>
          </div>
        </div>
      </div>

      <div className="chart-card">
        {interfaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-text">Loading interfaces…</div>
          </div>
        ) : (
          <div className="iface-list">
            {interfaces.map((iface) => {
              const isActive = iface.name === data.interfaceName;
              const isPending = selecting === iface.name;
              const statusLower = iface.status.toLowerCase();
              const isUp = statusLower === "up";
              const isSelectable = isUp;
              const statusLabel = iface.status || "Unknown";
              const badgeLabel = isPending
                ? "Switching…"
                : isActive
                  ? "Active"
                  : statusLabel;
              const badgeClass = isActive
                ? "active"
                : isPending
                  ? "selected"
                  : isUp
                    ? "connected"
                    : "disconnected";
              const linkSpeedLabel = formatLinkSpeed(iface.linkSpeedBps);
              const macLabel = iface.mac || "—";

              return (
                <div
                  key={iface.name}
                  className={`iface-row ${isSelectable ? "" : "disabled"}`}
                  onClick={() =>
                    isSelectable ? select(iface.name) : undefined
                  }
                  aria-disabled={!isSelectable}
                >
                  <div
                    className={`iface-icon ${isUp ? "up" : "down"} ${!isActive && !isPending ? "inactive" : ""}`}
                  >
                    {isUp ? "⌘" : "◌"}
                  </div>
                  <div className="iface-main">
                    <div className="iface-name">{iface.name}</div>
                    <div className="iface-addr">{iface.description || "—"}</div>
                    <div className="iface-meta">
                      IF {iface.ifIndex} · {macLabel}
                    </div>
                  </div>
                  <div className="iface-details">
                    <div className="iface-stat">
                      <div className="iface-stat-label">Link</div>
                      <div className="iface-stat-value">{linkSpeedLabel}</div>
                    </div>
                    <div className="iface-stat">
                      <div className="iface-stat-label">Status</div>
                      <div className="iface-stat-value">{statusLabel}</div>
                    </div>
                  </div>
                  <span className={`iface-badge ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
