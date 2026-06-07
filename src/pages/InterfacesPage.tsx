import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "@/store/networkStore";

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
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");

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

  const totalCount = interfaces.length;
  const upCount = interfaces.filter(
    (iface) => iface.status.toLowerCase() === "up",
  ).length;
  const downCount = totalCount - upCount;

  const visibleInterfaces = interfaces.filter((iface) => {
    if (filter === "all") {
      return true;
    }
    const isUp = iface.status.toLowerCase() === "up";
    return filter === "up" ? isUp : !isUp;
  });

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

      <div className="iface-hero">
        <div className="iface-hero-card">
          <div className="iface-hero-title">Active Interface</div>
          <div className="iface-hero-value">
            {data.interfaceName || "No active interface"}
          </div>
          <div className="iface-hero-meta">
            {upCount} up · {downCount} down · {totalCount} total
          </div>
        </div>
        <div className="iface-hero-card iface-hero-actions">
          <div className="iface-hero-title">Filter</div>
          <div className="iface-chips">
            <button
              className={`iface-chip ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
              type="button"
            >
              All ({totalCount})
            </button>
            <button
              className={`iface-chip ${filter === "up" ? "active" : ""}`}
              onClick={() => setFilter("up")}
              type="button"
            >
              Up ({upCount})
            </button>
            <button
              className={`iface-chip ${filter === "down" ? "active" : ""}`}
              onClick={() => setFilter("down")}
              type="button"
            >
              Down ({downCount})
            </button>
          </div>
        </div>
      </div>

      <div className="chart-card">
        {visibleInterfaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-text">
              {interfaces.length === 0
                ? "Loading interfaces…"
                : "No interfaces match this filter."}
            </div>
          </div>
        ) : (
          <div className="iface-list">
            {visibleInterfaces.map((iface) => {
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
                  className={`iface-row ${isSelectable ? "" : "disabled"} ${isActive ? "highlight" : ""}`}
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
                    <div className="iface-name" title={iface.name}>
                      {iface.name}
                    </div>
                    <div className="iface-addr" title={iface.description || ""}>
                      {iface.description || "—"}
                    </div>
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
