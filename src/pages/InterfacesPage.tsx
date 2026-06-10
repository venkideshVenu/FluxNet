import { useEffect, useState, useCallback, useRef } from "react";
import { useNetworkStore } from "@/store";
import { formatLinkSpeed, invokeWithTimeout, setStorageItem } from "@/utils";

type InterfaceInfo = {
  name: string;
  description: string;
  if_index: number;
  status: string;
  mac: string;
  link_speed_bps: number;
  interface_type: string;
};

function getInterfaceIcon(interfaceType: string, isUp: boolean): string {
  if (!isUp) return "◌";
  switch (interfaceType) {
    case "wifi":
      return "📶";
    case "ethernet":
      return "🔌";
    case "usb":
      return "🔗";
    case "bluetooth":
      return "🔵";
    case "cellular":
      return "📱";
    case "vpn":
      return "🔒";
    case "virtual":
      return "💻";
    case "tunnel":
      return "🚇";
    default:
      return "⌘";
  }
}

/** How often to refresh interface list (ms) */
const POLL_INTERVAL_MS = 3000;

export function InterfacesPage() {
  const { data } = useNetworkStore();
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInterfaces = useCallback(async () => {
    try {
      const result = await invokeWithTimeout<InterfaceInfo[]>("get_interfaces");
      setInterfaces(result);
      setError(null);
    } catch (err) {
      console.error("Failed to load interfaces:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Initial load + periodic refresh
  useEffect(() => {
    // Fetch immediately on mount
    loadInterfaces();

    // Set up polling interval
    timerRef.current = setInterval(loadInterfaces, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadInterfaces]);

  // Also refresh when the active interface changes (from the network store)
  const currentInterface = data.interfaceName;
  const prevInterfaceRef = useRef(currentInterface);
  useEffect(() => {
    if (prevInterfaceRef.current !== currentInterface) {
      prevInterfaceRef.current = currentInterface;
      // Refresh immediately when the monitored interface changes
      loadInterfaces();
    }
  }, [currentInterface, loadInterfaces]);

  const select = async (name: string) => {
    setSelecting(name);
    setSelectError(null);
    try {
      await invokeWithTimeout("set_interface", { name });
      setStorageItem("fluxnet_configured", "true");
      // Refresh list immediately after selection to show updated state
      await loadInterfaces();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("set_interface failed:", msg);
      setSelectError(`Failed to select "${name}": ${msg}`);
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
            {" · "}
            <span style={{ opacity: 0.6 }}>
              Auto-refreshing every {POLL_INTERVAL_MS / 1000}s
            </span>
          </div>
        </div>
      </div>

      {selectError && (
        <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          <span className="error-banner-text">⚠️ {selectError}</span>
          <button
            type="button"
            className="error-banner-dismiss"
            onClick={() => setSelectError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
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
          <button
            type="button"
            className="btn-retry"
            onClick={loadInterfaces}
            style={{ marginTop: 8, fontSize: 11 }}
          >
            ↻ Refresh now
          </button>
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
                loadInterfaces();
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
              const isSelectable = isUp && !isActive && !isPending;
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
              const linkSpeedLabel = formatLinkSpeed(iface.link_speed_bps);
              const macLabel = iface.mac || "—";
              const icon = getInterfaceIcon(iface.interface_type, isUp);

              return (
                <button
                  key={iface.name}
                  type="button"
                  className={`iface-row ${!isSelectable ? "disabled" : ""} ${isActive ? "highlight" : ""}`}
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
                    {icon}
                  </div>
                  <div className="iface-main">
                    <div className="iface-name" title={iface.name}>
                      {iface.name}
                    </div>
                    <div className="iface-addr" title={iface.description || ""}>
                      {iface.description || "—"}
                    </div>
                    <div className="iface-meta">
                      IF {iface.if_index} · {macLabel} · {iface.interface_type}
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
