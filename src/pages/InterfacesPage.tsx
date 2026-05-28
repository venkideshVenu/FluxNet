import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "../store/networkStore";

export function InterfacesPage() {
  const { data } = useNetworkStore();
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("get_interfaces").then(setInterfaces).catch(console.error);
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

  const isLoopback = (n: string) =>
    n === "lo" || n.toLowerCase().includes("loopback");

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
              const isActive  = iface === data.interfaceName;
              const isLoop    = isLoopback(iface);
              const isPending = selecting === iface;

              return (
                <div
                  key={iface}
                  className="iface-row"
                  onClick={() => !isLoop && select(iface)}
                  style={{ opacity: isLoop ? 0.5 : 1, cursor: isLoop ? "default" : "pointer" }}
                >
                  <div className={`iface-icon ${!isActive && !isPending ? "inactive" : ""}`}>
                    {isLoop ? "⟳" : "⌘"}
                  </div>
                  <div>
                    <div className="iface-name">{iface}</div>
                    <div className="iface-addr">
                      {isLoop ? "Loopback — not monitorable" : "Click to monitor"}
                    </div>
                  </div>
                  <span className={`iface-badge ${isActive ? "active" : isPending ? "selected" : "idle"}`}>
                    {isPending ? "Switching…" : isActive ? "Active" : "Idle"}
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