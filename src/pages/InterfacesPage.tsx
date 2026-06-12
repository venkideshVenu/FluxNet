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

  useEffect(() => {
    loadInterfaces();
    timerRef.current = setInterval(loadInterfaces, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadInterfaces]);

  const currentInterface = data.interfaceName;
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
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
            Interfaces
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Currently monitoring: <strong>{data.interfaceName || "—"}</strong>
            {" · "}
            <span className="opacity-60">
              Auto-refreshing every {POLL_INTERVAL_MS / 1000}s
            </span>
          </div>
        </div>
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
            aria-label="Dismiss"
            className="bg-transparent border-none text-danger-text cursor-pointer text-base px-1 leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="grid grid-cols-[1.2fr_1fr] gap-4 mb-4.5 max-[900px]:grid-cols-1">
        <div className="rounded-xl border border-border bg-[radial-gradient(120%_120%_at_10%_0%,rgba(124,111,247,0.12),transparent_50%),var(--panel)] px-4.5 py-4 shadow-lg">
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-bold">
            Active Interface
          </div>
          <div className="text-lg font-bold text-text mt-2 tracking-[-0.01em]">
            {data.interfaceName || "No active interface"}
          </div>
          <div className="mt-1.5 text-[12px] text-text-subtle">
            {upCount} up · {downCount} down · {totalCount} total
          </div>
        </div>
        <div className="rounded-xl border border-border bg-[radial-gradient(120%_120%_at_10%_0%,rgba(124,111,247,0.12),transparent_50%),var(--panel)] px-4.5 py-4 shadow-lg flex flex-col justify-center">
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-bold">
            Filter
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(["all", "up", "down"] as const).map((f) => {
              const count =
                f === "all" ? totalCount : f === "up" ? upCount : downCount;
              return (
                <button
                  key={f}
                  className={`border px-2.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all hover:-translate-y-px hover:border-accent-border hover:text-accent-strong ${
                    filter === f
                      ? "bg-accent-soft text-accent-strong border-accent-border"
                      : "bg-accent-soft-2 text-text-subtle border-border"
                  }`}
                  onClick={() => setFilter(f)}
                  type="button"
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={loadInterfaces}
            className="mt-2 text-[11px] bg-accent-soft text-accent border border-accent-border rounded-[7px] px-3.5 py-1.5 cursor-pointer font-sans hover:bg-accent-soft-2"
          >
            ↻ Refresh now
          </button>
        </div>
      </div>

      {/* Interface List */}
      <div className="bg-panel border border-border rounded-lg p-5">
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
              className="mt-3 bg-accent-soft text-accent border border-accent-border rounded-[7px] px-3.5 py-1.5 text-[12px] cursor-pointer font-sans hover:bg-accent-soft-2"
            >
              Retry
            </button>
          </div>
        ) : visibleInterfaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-text-muted">
            <div className="text-[32px] mb-3 opacity-40">⚡</div>
            <div className="text-[13px]">
              {interfaces.length === 0
                ? "Loading interfaces…"
                : "No interfaces match this filter."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visibleInterfaces.map((iface) => {
              const isActive = iface.name === data.interfaceName;
              const isPending = selecting === iface.name;
              const isUp = iface.status.toLowerCase() === "up";
              const isSelectable = isUp && !isActive && !isPending;
              const statusLabel = iface.status || "Unknown";
              const badgeLabel = isPending
                ? "Switching…"
                : isActive
                  ? "Active"
                  : statusLabel;
              const linkSpeedLabel = formatLinkSpeed(iface.link_speed_bps);
              const macLabel = iface.mac || "—";
              const icon = getInterfaceIcon(iface.interface_type, isUp);

              return (
                <button
                  key={iface.name}
                  type="button"
                  className={`grid items-center gap-3.5 grid-cols-[40px_minmax(180px,1fr)_auto_auto] p-3.5 px-4 rounded-lg border bg-panel cursor-pointer transition-all font-sans text-left text-inherit w-full ${
                    isActive
                      ? "border-success shadow-[0_12px_30px_rgba(34,217,125,0.12)]"
                      : "border-border"
                  } ${
                    !isSelectable
                      ? "cursor-default opacity-60"
                      : "hover:border-accent-border hover:shadow-md hover:-translate-y-px"
                  }`}
                  onClick={() =>
                    isSelectable ? select(iface.name) : undefined
                  }
                  disabled={!isSelectable}
                  aria-label={`${iface.name} — ${statusLabel}${isActive ? " (active)" : ""}`}
                >
                  <div
                    className={`w-9.5 h-9.5 rounded-[10px] flex items-center justify-center shrink-0 ${
                      isUp && (isActive || isPending)
                        ? "bg-success-bg text-success"
                        : isUp
                          ? "bg-accent-soft-2 text-text-muted"
                          : "bg-accent-soft-2 text-text-muted opacity-60"
                    }`}
                  >
                    {icon}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <div className="text-[15px] font-semibold text-text transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                      {iface.name}
                    </div>
                    <div className="text-[12px] text-text-subtle mt-0.5 line-clamp-2 overflow-hidden">
                      {iface.description || "—"}
                    </div>
                    <div className="text-[11px] text-text-muted tracking-[0.02em] overflow-hidden text-ellipsis whitespace-nowrap">
                      IF {iface.if_index} · {macLabel} · {iface.interface_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-auto mr-3 shrink-0">
                    <div className="flex flex-col gap-0.5 min-w-22">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold">
                        Link
                      </div>
                      <div className="text-[12px] text-text font-semibold">
                        {linkSpeedLabel}
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-22">
                      <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted font-semibold">
                        Status
                      </div>
                      <div className="text-[12px] text-text font-semibold">
                        {statusLabel}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold rounded-[20px] px-2.5 py-1 justify-self-end ${
                      isActive
                        ? "bg-success-bg text-success"
                        : isPending
                          ? "bg-accent-soft text-accent-strong"
                          : isUp
                            ? "bg-accent-soft text-accent-strong"
                            : "bg-accent-soft-2 text-text-muted"
                    }`}
                  >
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
