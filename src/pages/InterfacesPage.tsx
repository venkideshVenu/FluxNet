import { useEffect, useState } from "react";
import { useNetworkStore } from "@/store";
import {
  formatLinkSpeed,
  invokeWithTimeout,
  getStorageItem,
  setStorageItem,
} from "@/utils";

type InterfaceInfo = {
  name: string;
  description: string;
  ifIndex: number;
  status: string;
  mac: string;
  linkSpeedBps: number;
};

export function InterfacesPage() {
  const { data } = useNetworkStore();
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");
  const [error, setError] = useState<string | null>(null);

  const isFirstRun = !getStorageItem("fluxnet_configured", "");

  useEffect(() => {
    invokeWithTimeout<InterfaceInfo[]>("get_interfaces")
      .then(setInterfaces)
      .catch((err) => {
        console.error("Failed to load interfaces:", err);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const select = async (name: string) => {
    setSelecting(name);
    try {
      await invokeWithTimeout("set_interface", { name });
      setStorageItem("fluxnet_configured", "true");
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
    if (filter === "all") return true;
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

      {isFirstRun && (
        <div className="first-run-banner">
          <span className="first-run-banner-icon">🎯</span>
          <div className="first-run-banner-text">
            <strong>Select your network interface to begin monitoring</strong>
            Choose an active (Up) interface from the list below. FluxNet will
            start tracking bandwidth immediately.
          </div>
        </div>
      )}

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
        {error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-text">
              Failed to load interfaces: {error}
            </div>
            <button
              type="button"
              className="btn-retry"
              onClick={() => {
                setError(null);
                invokeWithTimeout<InterfaceInfo[]>("get_interfaces")
                  .then(setInterfaces)
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : String(err));
                  });
              }}
            >
              Retry
            </button>
          </div>
        ) : visibleInterfaces.length === 0 ? (
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
                <button
                  key={iface.name}
                  type="button"
                  className={`iface-row ${isSelectable ? "" : "disabled"} ${isActive ? "highlight" : ""}`}
                  onClick={() =>
                    isSelectable ? select(iface.name) : undefined
                  }
                  disabled={!isSelectable}
                  aria-label={`${iface.name} — ${statusLabel}${isActive ? " (active)" : ""}`}
                >
                  <div
                    className={`iface-icon ${isUp ? "up" : "down"} ${!isActive && !isPending ? "inactive" : ""}`}
                    aria-hidden="true"
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
