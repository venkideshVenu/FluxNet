import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getStorageItem } from "@/utils";

/**
 * Returns whether onboarding has been completed.
 * - `null` = still checking (loading state)
 * - `true` = onboarding done, show app
 * - `false` = first launch, show onboarding
 *
 * Checks backend (source of truth) with localStorage as fast-path cache.
 */
export function useOnboardingGuard(): boolean | null {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    // Fast path: if localStorage says configured, trust it immediately
    const localFlag = getStorageItem("fluxnet_configured", "");
    if (localFlag === "true") {
      setCompleted(true);
      return;
    }

    // Otherwise check backend (survives WebView storage resets / app updates)
    invoke<boolean>("get_onboarding_completed")
      .then((backendCompleted) => {
        if (backendCompleted) {
          // Backend says done — sync localStorage and proceed
          localStorage.setItem("fluxnet_configured", "true");
          setCompleted(true);
        } else {
          setCompleted(false);
        }
      })
      .catch(() => {
        // If backend call fails, fall back to localStorage
        setCompleted(!!localFlag);
      });
  }, []);

  return completed;
}
