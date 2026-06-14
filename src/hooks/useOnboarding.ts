import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getStorageItem, setStorageItem } from "@/utils";

/**
 * Returns whether onboarding has been completed.
 * - `null` = still checking (loading state)
 * - `true` = onboarding done, show app
 * - `false` = first launch, show onboarding
 *
 * The backend (app-settings.json) is always the source of truth.
 * localStorage is used only as an optimistic initial value to reduce
 * the loading flash — but the backend result always overrides it.
 */
export function useOnboardingGuard(): boolean | null {
  // Seed with localStorage so we can skip the loading spinner on fast repeat
  // launches. This is immediately corrected by the backend check below.
  const localFlag = getStorageItem("fluxnet_configured", "");
  const [completed, setCompleted] = useState<boolean | null>(
    localFlag === "true" ? true : null,
  );

  useEffect(() => {
    let isMounted = true;

    // ALWAYS verify with the backend — localStorage is only an optimistic hint,
    // not the source of truth. This catches cases like:
    //   - User manually resets app-settings.json to onboarding_completed: false
    //   - App data was wiped but WebView storage survived
    //   - Developer testing / QA resets
    invoke<boolean>("get_onboarding_completed")
      .then((backendCompleted) => {
        if (!isMounted) return;

        if (backendCompleted) {
          // Keep (or promote) localStorage in sync
          setStorageItem("fluxnet_configured", "true");
          setCompleted(true);
        } else {
          // Backend says not done — localStorage was stale, clear it and show onboarding
          setStorageItem("fluxnet_configured", "false");
          setCompleted(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Backend unreachable — fall back to whatever we had from localStorage.
        // Don't change state if we already have a value from the optimistic seed.
        if (completed === null) {
          setStorageItem("fluxnet_configured", "false");
          setCompleted(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only

  return completed;
}
