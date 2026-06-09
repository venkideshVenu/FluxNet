import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useNetworkPoller, useThemeSync } from "@/hooks";
import { Sidebar } from "@/components";
import { DashboardPage } from "@/pages";
import { HistoryPage } from "@/pages";
import { InterfacesPage } from "@/pages";
import { AlertsPage } from "@/pages";
import { SettingsPage } from "@/pages";
import { WidgetSettingsPage } from "@/pages";
import { getStorageItem } from "@/utils";
import "./styles/dashboard/layout.css";
import "./styles/dashboard/components.css";
import "./styles/dashboard/pages.css";
import { AppProviders } from "./AppProviders";

/**
 * FIX: Issue 13.3 — First-run redirect component.
 * Detects if this is the user's first launch and redirects to Interfaces page.
 */
function FirstRunRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    const configured = getStorageItem("fluxnet_configured", "");
    if (!configured && location.pathname === "/") {
      navigate("/interfaces", { replace: true });
    }
    setChecked(true);
  }, [checked, navigate, location.pathname]);

  return null;
}

function DashboardContent() {
  useNetworkPoller();
  useThemeSync();

  return (
    <div className="app-shell">
      {/* FIX: Issue 12.6 — Skip navigation for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar />
      <main id="main-content" className="app-content">
        <FirstRunRedirect />
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
  );
}

export default function DashboardApp() {
  return (
    <AppProviders>
      <BrowserRouter>
        <DashboardContent />
      </BrowserRouter>
    </AppProviders>
  );
}
