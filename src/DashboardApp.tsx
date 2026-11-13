import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useNetworkPoller, useOnboardingGuard, useThemeSync } from "@/hooks";
import { Sidebar } from "@/components";
import { ProgressRing } from "@/components/fluent";
import {
  DashboardPage,
  HistoryPage,
  InterfacesPage,
  OnboardingPage,
  SettingsPage,
  WidgetSettingsPage,
} from "@/pages";
import { AppProviders } from "@/AppProviders";

function OnboardingRouter() {
  useThemeSync();
  const completed = useOnboardingGuard();

  if (completed === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <ProgressRing />
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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <a
        href="#main-content"
        className="absolute -top-full left-2 z-50 rounded-control bg-accent px-3 py-1.5 text-on-accent focus:top-2"
      >
        Skip to content
      </a>
      <Sidebar />
      {/* The content layer: on Windows 11 it floats over Mica like WinUI apps. */}
      <main
        id="main-content"
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-tl-card border-t border-l border-layer-stroke bg-layer"
      >
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/usage" element={<HistoryPage />} />
          <Route path="/adapters" element={<InterfacesPage />} />
          <Route path="/widgets" element={<WidgetSettingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Old paths, kept so saved links and habits keep working. */}
          <Route path="/history" element={<Navigate to="/usage" replace />} />
          <Route
            path="/interfaces"
            element={<Navigate to="/adapters" replace />}
          />
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
