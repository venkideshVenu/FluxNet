import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { Sidebar } from "./components/dashboard/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { AlertsPage } from "./pages/AlertsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WidgetSettingsPage } from "./pages/WidgetSettingsPage";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
} from "./utils/theme";
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
