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

/** Gives the dashboard its accent and backdrop before the first paint. */
async function prepareDashboard() {
  const [
    { fetchAppearance },
    { applyAppearance, applyColorMode, getStoredColorMode },
  ] = await Promise.all([import("@/api/appearanceApi"), import("@/utils")]);
  try {
    applyColorMode(getStoredColorMode());
  } catch {
    applyColorMode("system");
  }
  const appearance = await Promise.race([
    fetchAppearance(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
  ]);
  applyAppearance(appearance);
}

async function boot() {
  // In `pnpm dev:web` (a plain browser, no Tauri) use a fake backend so the
  // UI can be developed and reviewed on any OS. Removed from release builds.
  if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
    const { installMockBackend } = await import("./dev/mockBackend");
    installMockBackend();
  }

  const label = getCurrentWindow().label;
  document.documentElement.setAttribute("data-app", label);

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element #root not found in DOM");

  const loader = loaders[label];
  if (!loader) await prepareDashboard();
  const { default: Root } = await (loader ?? loadDashboard)();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

boot();
