import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useNetworkPoller, useThemeSync, useOnboardingGuard } from "@/hooks";
import { Sidebar } from "@/components";
import {
  DashboardPage,
  HistoryPage,
  InterfacesPage,
  SettingsPage,
  WidgetSettingsPage,
  OnboardingPage,
} from "@/pages";
import { AppProviders } from "@/AppProviders";

function OnboardingRouter() {
  const completed = useOnboardingGuard();

  if (completed === null) {
    return (
      <div className="w-screen h-screen bg-bg flex items-center justify-center">
        <div className="text-[12px] text-text-muted">Loading…</div>
      </div>
    );
  }

  if (!completed) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    );
  }

  return <DashboardContent />;
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
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/interfaces" element={<InterfacesPage />} />
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
        <OnboardingRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
