import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { CompactWidget } from "./components/CompactWidget";
import {
  applyColorMode,
  getStoredCompactMode,
  LS_COMPACT_MODE,
} from "./utils/theme";
import {
  getStoredCompactAlwaysOnTop,
  LS_COMPACT_ALWAYS_ON_TOP,
} from "./utils/windowPrefs";
import "./compact.css";

const LS_COMPACT_OPACITY = "fluxnet_compact_opacity";

function getStoredOpacity(key: string, fallback = 88): number {
  const saved = localStorage.getItem(key);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function CompactApp() {
  useNetworkPoller();

  useEffect(() => {
    applyColorMode(getStoredCompactMode());

    const applyAlwaysOnTop = async () => {
      try {
        await invoke("set_compact_always_on_top", {
          value: getStoredCompactAlwaysOnTop(),
        });
      } catch (err) {
        console.error("apply compact always-on-top failed:", err);
      }
    };

    const applyOpacity = async () => {
      try {
        await invoke("set_compact_opacity", {
          value: getStoredOpacity(LS_COMPACT_OPACITY) / 100,
        });
      } catch (err) {
        console.error("apply compact opacity failed:", err);
      }
    };

    applyAlwaysOnTop();
    applyOpacity();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_COMPACT_ALWAYS_ON_TOP) {
        void invoke("set_compact_always_on_top", {
          value: event.newValue === "true",
        });
        return;
      }

      if (event.key === LS_COMPACT_OPACITY && event.newValue) {
        const next = Number(event.newValue);
        if (Number.isFinite(next)) {
          void invoke("set_compact_opacity", { value: next / 100 });
        }
        return;
      }

      if (event.key === LS_COMPACT_MODE && event.newValue) {
        if (event.newValue === "light" || event.newValue === "dark") {
          applyColorMode(event.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <CompactWidget />;
}
