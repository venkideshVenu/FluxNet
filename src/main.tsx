import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PillApp from "@/PillApp";
import CompactApp from "@/CompactApp";
import HudApp from "@/HudApp";
import DashboardApp from "@/DashboardApp";
import "@/index.css";

async function boot() {
  const label = getCurrentWindow().label;
  const Root =
    label === "pill"
      ? PillApp
      : label === "compact"
        ? CompactApp
        : label === "hud"
          ? HudApp
          : DashboardApp;

  document.documentElement.setAttribute("data-app", label);

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root not found in DOM");

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

boot();
