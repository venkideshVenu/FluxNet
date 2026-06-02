import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import { applyColorMode, getStoredPillMode, LS_PILL_MODE } from "./utils/theme";
import {
  getStoredPillAlwaysOnTop,
  LS_PILL_ALWAYS_ON_TOP,
} from "./utils/windowPrefs";
import "./pill.css";

const LS_PILL_OPACITY = "fluxnet_opacity";

function getStoredOpacity(key: string, fallback = 88): number {
  const saved = localStorage.getItem(key);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function PillApp() {
  useNetworkPoller();

  useEffect(() => {
    applyColorMode(getStoredPillMode());

    const applyAlwaysOnTop = async () => {
      try {
        await invoke("set_pill_always_on_top", {
          value: getStoredPillAlwaysOnTop(),
        });
      } catch (err) {
        console.error("apply pill always-on-top failed:", err);
      }
    };

    const applyOpacity = async () => {
      try {
        await invoke("set_pill_opacity", {
          value: getStoredOpacity(LS_PILL_OPACITY) / 100,
        });
      } catch (err) {
        console.error("apply pill opacity failed:", err);
      }
    };

    applyAlwaysOnTop();
    applyOpacity();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_PILL_ALWAYS_ON_TOP) {
        void invoke("set_pill_always_on_top", {
          value: event.newValue === "true",
        });
        return;
      }

      if (event.key === LS_PILL_OPACITY && event.newValue) {
        const next = Number(event.newValue);
        if (Number.isFinite(next)) {
          void invoke("set_pill_opacity", { value: next / 100 });
        }
        return;
      }

      if (event.key === LS_PILL_MODE && event.newValue) {
        if (event.newValue === "light" || event.newValue === "dark") {
          applyColorMode(event.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <PillWidget />;
}
