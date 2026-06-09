import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useNetworkPoller, useThemeSync } from "@/hooks";
import { Sidebar } from "@/components";
import { DashboardPage } from "@/pages";
import { HistoryPage } from "@/pages";
import { InterfacesPage } from "@/pages";
import { AlertsPage } from "@/pages";
import { SettingsPage } from "@/pages";
import { WidgetSettingsPage } from "@/pages";

import "./dashboard.css";
import { AppProviders } from "./AppProviders";

export default function DashboardApp() {
  useNetworkPoller();
  useThemeSync();

  return (
    <AppProviders>
      <BrowserRouter>
        <div className="app-shell">
          <Sidebar />
          <main id="main-content" className="app-content">
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
    </AppProviders>
  );
}
