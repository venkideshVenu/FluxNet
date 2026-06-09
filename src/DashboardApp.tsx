import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useNetworkPoller } from "@/hooks";
import { Sidebar } from "@/components";
import { DashboardPage } from "@/pages";
import { HistoryPage } from "@/pages";
import { InterfacesPage } from "@/pages";
import { AlertsPage } from "@/pages";
import { SettingsPage } from "@/pages";
import { WidgetSettingsPage } from "@/pages";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
} from "@/utils";
import "./dashboard.css";

export default function DashboardApp() {
  // No argument needed — the poller reads its interval from the store
  useNetworkPoller();

  useEffect(() => {
    const index = getStoredAccentIndex();
    const swatch = THEMES[index] ?? THEMES[0];
    applyAccent(swatch.color);
    applyColorMode(getStoredColorMode());
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/interfaces" element={<InterfacesPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/widgets" element={<WidgetSettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
