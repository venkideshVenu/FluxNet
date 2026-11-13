import { usePingPoller, useKeyboardNudge, useDragToMove } from "@/hooks";
import { useNetworkStore, usePingStore, useSettingsStore } from "@/store";
import {
  cacheHudDesign,
  formatSpeed,
  getCachedHudDesign,
  parseHudDesign,
} from "@/utils";
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

  // Start from the cached value so a recreated window renders the right
  // layout immediately; the backend value below is authoritative.
  const [design, setDesign] = useState<HudDesign>(getCachedHudDesign);

  useEffect(() => {
    let alive = true;
    invoke<string>("get_hud_design")
      .then((value) => {
        const d = parseHudDesign(value);
        if (alive && d) {
          setDesign(d);
          cacheHudDesign(d);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Listen for design changes pushed from the dashboard via eval
  useEffect(() => {
    const handler = () => {
      const d = parseHudDesign(
        (window as { __FLUXNET_HUD_DESIGN?: unknown }).__FLUXNET_HUD_DESIGN,
      );
      if (d) {
        setDesign(d);
        cacheHudDesign(d);
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
