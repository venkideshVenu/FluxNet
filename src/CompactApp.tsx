import { useEffect } from "react";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { CompactWidget } from "./components/CompactWidget";
import "./compact.css";

export default function CompactApp() {
  useNetworkPoller();

  // Detect OS dark mode and apply class to root
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e: MediaQueryListEvent | MediaQueryList) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return <CompactWidget />;
}
