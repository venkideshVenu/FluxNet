import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "../store/networkStore";

type InterfaceInfo = {
  name: string;
  connected: boolean;
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
              const badgeLabel = isPending
                ? "Switching…"
                : isActive
                  ? "Active"
                  : iface.connected
                    ? "Connected"
                    : "Disconnected";

              return (
                <div
                  key={iface.name}
                  className="iface-row"
                  onClick={() => select(iface.name)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className={`iface-icon ${!isActive && !isPending ? "inactive" : ""}`}
                  >
                    {iface.connected ? "⌘" : "◌"}
                  </div>
                  <div>
                    <div className="iface-name">{iface.name}</div>
                    <div className="iface-addr">
                      {iface.connected ? "Connected" : "Disconnected"}
                    </div>
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
