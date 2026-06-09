import { ReactNode } from "react";
import { ErrorBoundary } from "@/components";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
