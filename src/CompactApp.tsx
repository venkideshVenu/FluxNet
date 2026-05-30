import { useEffect } from "react";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { CompactWidget } from "./components/CompactWidget";
import {
  applyColorMode,
  getStoredCompactMode,
  LS_COMPACT_MODE,
} from "./utils/theme";
import "./compact.css";

export default function CompactApp() {
  useNetworkPoller();

  useEffect(() => {
    applyColorMode(getStoredCompactMode());

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LS_COMPACT_MODE || !event.newValue) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        applyColorMode(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <CompactWidget />;
}
