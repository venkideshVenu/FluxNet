import { ReactNode } from "react";
import { ErrorBoundary } from "@/components";
import { ToastProvider } from "@/components";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}
