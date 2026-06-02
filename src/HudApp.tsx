import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { GamingHud } from "./components/GamingHud";
import { applyColorMode, getStoredHudMode, LS_HUD_MODE } from "./utils/theme";
import {
  getStoredHudAlwaysOnTop,
  LS_HUD_ALWAYS_ON_TOP,
} from "./utils/windowPrefs";
import "./hud.css";

const LS_HUD_OPACITY = "fluxnet_hud_opacity";

function getStoredOpacity(key: string, fallback = 88): number {
  const saved = localStorage.getItem(key);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function HudApp() {
  useNetworkPoller();

  useEffect(() => {
    applyColorMode(getStoredHudMode());

    const applyAlwaysOnTop = async () => {
      try {
        await invoke("set_hud_always_on_top", {
          value: getStoredHudAlwaysOnTop(),
        });
      } catch (err) {
        console.error("apply hud always-on-top failed:", err);
      }
    };

    const applyOpacity = async () => {
      try {
        await invoke("set_hud_opacity", {
          value: getStoredOpacity(LS_HUD_OPACITY) / 100,
        });
      } catch (err) {
        console.error("apply hud opacity failed:", err);
      }
    };

    applyAlwaysOnTop();
    applyOpacity();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_HUD_ALWAYS_ON_TOP) {
        void invoke("set_hud_always_on_top", {
          value: event.newValue === "true",
        });
        return;
      }

      if (event.key === LS_HUD_OPACITY && event.newValue) {
        const next = Number(event.newValue);
        if (Number.isFinite(next)) {
          void invoke("set_hud_opacity", { value: next / 100 });
        }
        return;
      }

      if (event.key === LS_HUD_MODE && event.newValue) {
        if (event.newValue === "light" || event.newValue === "dark") {
          applyColorMode(event.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <GamingHud />;
}
