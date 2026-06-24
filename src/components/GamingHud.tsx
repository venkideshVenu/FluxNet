import { usePingPoller, useKeyboardNudge, useDragToMove } from "@/hooks";
import { useNetworkStore, usePingStore, useSettingsStore } from "@/store";
import { formatSpeed } from "@/utils";
import { HudPresentation } from "./HudPresentation";
import type { HudDesign } from "./HudPresentation";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function GamingHud() {
  usePingPoller(2000);

  const { data } = useNetworkStore();
  const { stats } = usePingStore();

  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const up = formatSpeed(data.uploadBytesPerSec, displayUnits);
  const dn = formatSpeed(data.downloadBytesPerSec, displayUnits);

  const [design, setDesign] = useState<HudDesign>("horizontal");

  // Load design from backend on mount
  useEffect(() => {
    invoke<string>("get_hud_design")
      .then((d) => setDesign(d as HudDesign))
      .catch(() => {});
  }, []);

  // Listen for design changes pushed from main window via eval
  useEffect(() => {
    const handler = () => {
      const d = (window as any).__FLUXNET_HUD_DESIGN;
      if (d === "horizontal" || d === "vertical") {
        setDesign(d);
      }
    };
    window.addEventListener("fluxnet_hud_design_changed", handler);
    return () =>
      window.removeEventListener("fluxnet_hud_design_changed", handler);
  }, []);

  const handleDrag = useDragToMove();
  const handleKeyNudge = useKeyboardNudge();

  return (
    <div
      onMouseDown={handleDrag}
      onKeyDown={handleKeyNudge}
      role="status"
      tabIndex={0}
      aria-label={`Ping ${stats.latencyMs ?? "unknown"} ms, Download ${dn.value} ${dn.unit}, Upload ${up.value} ${up.unit}, Packet loss ${stats.lossPercent.toFixed(0)} percent`}
      className="w-full h-full focus-visible:outline-2 focus-visible:outline-(--hud-amber) focus-visible:outline-offset-2"
    >
      <HudPresentation
        downloadValue={dn.value}
        downloadUnit={dn.unit}
        uploadValue={up.value}
        uploadUnit={up.unit}
        latencyMs={stats.latencyMs}
        lossPercent={stats.lossPercent}
        design={design}
      />
    </div>
  );
}
