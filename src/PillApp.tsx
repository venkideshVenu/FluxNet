import { useEffect } from "react";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { PillWidget } from "./components/PillWidget";
import { applyColorMode, getStoredPillMode, LS_PILL_MODE } from "./utils/theme";
import "./App.css";

export default function PillApp() {
  useNetworkPoller();

  useEffect(() => {
    applyColorMode(getStoredPillMode());

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LS_PILL_MODE || !event.newValue) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        applyColorMode(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <PillWidget />;
}
