import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "../store/networkStore";

type InterfaceInfo = {
  name: string;
  status: string;
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
              const isDisconnected = statusLower === "disconnected";
              const isSelectable = !isDisconnected;
              const statusLabel = iface.status || "Unknown";
              const badgeLabel = isPending
                ? "Switching…"
                : isActive
                  ? "Active"
                  : statusLabel;

              return (
                <div
                  key={iface.name}
                  className="iface-row"
                  onClick={() =>
                    isSelectable ? select(iface.name) : undefined
                  }
                  style={{
                    cursor: isSelectable ? "pointer" : "default",
                    opacity: isSelectable ? 1 : 0.5,
                  }}
                >
                  <div
                    className={`iface-icon ${!isActive && !isPending ? "inactive" : ""}`}
                  >
                    {statusLower === "up" ? "⌘" : "◌"}
                  </div>
                  <div>
                    <div className="iface-name">{iface.name}</div>
                    <div className="iface-addr">{statusLabel}</div>
                  </div>
                  <span
                    className={`iface-badge ${isActive ? "active" : isPending ? "selected" : "idle"}`}
                  >
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
