import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
// Widget stylesheets stay global: the dashboard's widget previews use their
// CSS variables, and index.css must load last to keep the cascade unchanged.
import "@/styles/pill.css";
import "@/styles/compact.css";
import "@/styles/hud.css";
import "@/index.css";

/**
 * Each window only downloads, parses and keeps in memory the code for its own
 * UI. Widget windows therefore never load the dashboard, router or charts.
 */
const loaders: Record<string, () => Promise<{ default: React.ComponentType }>> =
  {
    pill: () => import("@/PillApp"),
    compact: () => import("@/CompactApp"),
    hud: () => import("@/HudApp"),
  };

const loadDashboard = () => import("@/DashboardApp");

async function boot() {
  const label = getCurrentWindow().label;
  document.documentElement.setAttribute("data-app", label);

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root not found in DOM");

  const { default: Root } = await (loaders[label] ?? loadDashboard)();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

boot();
