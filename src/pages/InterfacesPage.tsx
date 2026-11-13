import { useEffect, useState, useCallback, useRef } from "react";
import { useNetworkStore } from "@/store";
import { formatLinkSpeed, invokeWithTimeout, setStorageItem } from "@/utils";
import {
  Wifi,
  Network,
  Cable,
  Bluetooth,
  Smartphone,
  Shield,
  Monitor,
  Route,
  CircleOff,
} from "lucide-react";

type InterfaceInfo = {
  name: string;
  description: string;
  if_index: number;
  status: string;
  mac: string;
  link_speed_bps: number;
  interface_type: string;
};

type MonitoringMode = "auto" | "manual";

function getInterfaceIcon(
  interfaceType: string,
  isUp: boolean,
): React.ReactNode {
  if (!isUp) return <CircleOff size={18} />;
  switch (interfaceType) {
    case "wifi":
      return <Wifi size={18} />;
    case "ethernet":
      return <Cable size={18} />;
    case "usb":
      return <Cable size={18} />;
    case "bluetooth":
      return <Bluetooth size={18} />;
    case "cellular":
      return <Smartphone size={18} />;
    case "vpn":
      return <Shield size={18} />;
    case "virtual":
      return <Monitor size={18} />;
    case "tunnel":
      return <Route size={18} />;
    default:
      return <Network size={18} />;
  }
}

const POLL_INTERVAL_MS = 3000;

export function InterfacesPage() {
  const currentInterface = useNetworkStore((s) => s.data.interfaceName);
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [monitoringMode, setMonitoringMode] = useState<MonitoringMode>("auto");
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

  useEffect(() => {
    loadInterfaces();
    // Skip refreshes while the dashboard is hidden (minimized or in the tray).
    timerRef.current = setInterval(() => {
      if (!document.hidden) loadInterfaces();
    }, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadInterfaces]);

  const prevInterfaceRef = useRef(currentInterface);
  useEffect(() => {
    if (prevInterfaceRef.current !== currentInterface) {
      prevInterfaceRef.current = currentInterface;
      loadInterfaces();
    }
  }, [currentInterface, loadInterfaces]);

  const select = async (name: string) => {
    setSelecting(name);
    setSelectError(null);
    try {
      await invokeWithTimeout("set_interface", { name });
      setStorageItem("fluxnet_configured", "true");
      await loadInterfaces();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSelectError(`Failed to select "${name}": ${msg}`);
    } finally {
      setSelecting(null);
    }
  };

  // Auto-detect best interface
  const autoDetected =
    interfaces.find(
      (i) =>
        i.status.toLowerCase() === "up" &&
        ["ethernet", "wifi"].includes(i.interface_type.toLowerCase()),
    ) || interfaces.find((i) => i.status.toLowerCase() === "up");

  const upInterfaces = interfaces.filter(
    (i) => i.status.toLowerCase() === "up",
  );
  const downInterfaces = interfaces.filter(
    (i) => i.status.toLowerCase() !== "up",
  );

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
            Interfaces
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Currently monitoring:{" "}
            <strong className="text-text">{currentInterface || "—"}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={loadInterfaces}
          className="text-[11px] bg-accent-soft text-accent-strong border border-accent-border rounded-lg px-3.5 py-1.5 cursor-pointer font-sans font-medium hover:bg-accent-soft-2 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {selectError && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 bg-danger-bg border border-danger-border rounded-md text-danger-text text-[12px] mb-4"
          role="alert"
        >
          <span className="flex-1">⚠️ {selectError}</span>
          <button
            type="button"
            onClick={() => setSelectError(null)}
            className="bg-transparent border-none text-danger-text cursor-pointer text-base px-1 leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Monitoring Mode Selector */}
      <div className="bg-panel border border-border rounded-xl p-5 mb-5">
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
          Monitoring Mode
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Auto option */}
          <button
            type="button"
            onClick={() => {
              setMonitoringMode("auto");
              if (autoDetected) select(autoDetected.name);
            }}
            className={`flex items-center gap-3.5 p-3.5 rounded-lg border text-left w-full cursor-pointer transition-all ${
              monitoringMode === "auto"
                ? "border-accent-border bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shadow-[0_0_0_1px_var(--accent-border)]"
                : "border-border hover:border-border-strong"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${monitoringMode === "auto" ? "border-accent" : "border-border-strong"}`}
            >
              {monitoringMode === "auto" && (
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-semibold ${monitoringMode === "auto" ? "text-accent" : "text-text"}`}
                >
                  Automatic
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success-bg text-success border border-[color-mix(in_srgb,var(--success)_25%,transparent)]">
                  Recommended
                </span>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                {autoDetected ? (
                  <>
                    Currently:{" "}
                    <strong className="text-text">{autoDetected.name}</strong> ·{" "}
                    {autoDetected.interface_type} · Connected
                  </>
                ) : (
                  "Automatically selects the best active interface"
                )}
              </div>
            </div>
          </button>

          {/* Manual option */}
          <button
            type="button"
            onClick={() => setMonitoringMode("manual")}
            className={`flex items-center gap-3.5 p-3.5 rounded-lg border text-left w-full cursor-pointer transition-all ${
              monitoringMode === "manual"
                ? "border-accent-border bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shadow-[0_0_0_1px_var(--accent-border)]"
                : "border-border hover:border-border-strong"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${monitoringMode === "manual" ? "border-accent" : "border-border-strong"}`}
            >
              {monitoringMode === "manual" && (
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
              )}
            </div>
            <div className="flex-1">
              <span
                className={`text-[13px] font-semibold ${monitoringMode === "manual" ? "text-accent" : "text-text"}`}
              >
                Manual
              </span>
              <div className="text-[11px] text-text-muted mt-1">
                Choose a specific network adapter
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Interface List (only shown in manual mode) */}
      {monitoringMode === "manual" && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
            Select Interface · {upInterfaces.length} active,{" "}
            {downInterfaces.length} inactive
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-text-muted">
              <div className="text-[32px] mb-3 opacity-40">⚠️</div>
              <div className="text-[13px]">
                Failed to load interfaces: {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  loadInterfaces();
                }}
                className="mt-3 bg-accent-soft text-accent-strong border border-accent-border rounded-lg px-3.5 py-1.5 text-[12px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : interfaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-text-muted">
              <div className="text-[32px] mb-3 opacity-40">⚡</div>
              <div className="text-[13px]">Loading interfaces…</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...upInterfaces, ...downInterfaces].map((iface) => {
                const isActive = iface.name === currentInterface;
                const isPending = selecting === iface.name;
                const isUp = iface.status.toLowerCase() === "up";
                const isSelectable = isUp && !isActive && !isPending;
                const icon = getInterfaceIcon(iface.interface_type, isUp);

                return (
                  <button
                    key={iface.name}
                    type="button"
                    className={`flex items-center gap-3.5 p-3.5 rounded-lg border transition-all text-left w-full ${
                      isActive
                        ? "border-success shadow-[0_0_0_1px_rgba(15,140,66,0.2)]"
                        : "border-border"
                    } ${isSelectable ? "cursor-pointer hover:border-accent-border hover:-translate-y-px" : "cursor-default"}`}
                    onClick={() =>
                      isSelectable ? select(iface.name) : undefined
                    }
                    disabled={!isSelectable}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-success-bg text-success"
                          : isUp
                            ? "bg-accent-soft text-accent-strong"
                            : "bg-surface text-text-muted"
                      }`}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[14px] font-semibold truncate ${!isUp ? "text-text-muted" : "text-text"}`}
                      >
                        {iface.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {iface.description || iface.interface_type}
                        {!isUp && " · Not connected"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-text-muted">
                        {formatLinkSpeed(iface.link_speed_bps)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                          isActive
                            ? "bg-success-bg text-success border-success"
                            : isPending
                              ? "bg-accent-soft text-accent-strong border-accent-border"
                              : isUp
                                ? "bg-surface text-text-muted border-border"
                                : "bg-surface text-text-muted border-border opacity-60"
                        }`}
                      >
                        {isPending
                          ? "Switching…"
                          : isActive
                            ? "Active"
                            : iface.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Auto mode status */}
      {monitoringMode === "auto" && autoDetected && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-bg text-success flex items-center justify-center">
              {getInterfaceIcon(autoDetected.interface_type, true)}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-text">
                {autoDetected.name}
              </div>
              <div className="text-[11px] text-text-muted">
                {autoDetected.description} ·{" "}
                {formatLinkSpeed(autoDetected.link_speed_bps)}
              </div>
            </div>
            <span className="ml-auto text-[10px] font-semibold rounded-full px-2.5 py-1 bg-success-bg text-success border border-success">
              Active
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-border text-[11px] text-text-muted">
            Automatically selected based on active network traffic. FluxNet will
            switch if your connection changes.
          </div>
        </div>
      )}
    </div>
  );
}
