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

    applyAlwaysOnTop();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_PILL_ALWAYS_ON_TOP) {
        void invoke("set_pill_always_on_top", {
          value: event.newValue === "true",
        });
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
