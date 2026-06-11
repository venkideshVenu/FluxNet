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
import { AppProviders } from "./AppProviders";

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
    <div className="flex w-screen h-screen overflow-hidden">
      <a
        href="#main-content"
        className="absolute -top-full left-0 z-9999 px-4 py-2 bg-accent text-white text-sm font-medium no-underline rounded-br-md focus:top-0 transition-[top] duration-200"
      >
        Skip to main content
      </a>

      <Sidebar />
      <main
        id="main-content"
        className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg scrollbar-none"
      >
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
