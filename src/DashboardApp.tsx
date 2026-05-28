import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useNetworkPoller } from "./hooks/useNetworkPoller";
import { Sidebar } from "./components/dashboard/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { AlertsPage } from "./pages/AlertsPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./dashboard.css";

export default function DashboardApp() {
  useNetworkPoller(1000);

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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
