/**
 * Writes to localStorage AND dispatches a StorageEvent for same-window listeners.
 *
 * Why this exists:
 * - localStorage.setItem() fires StorageEvent in OTHER windows (same origin) automatically.
 * - It does NOT fire in the SAME window that called setItem().
 * - Some listeners (e.g., useStoredInterval for the same window's settings) need same-window notification.
 * - This utility handles both cases cleanly.
 *
 * For cross-window only: Just use localStorage.setItem() — native events handle it.
 * For same-window + cross-window: Use this utility.
 */
export function setStorageWithNotify(key: string, value: string): void {
  const oldValue = localStorage.getItem(key);
  localStorage.setItem(key, value);

  // Dispatch for same-window listeners that need to react
  // (Native StorageEvent only fires in OTHER windows)
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      oldValue,
      newValue: value,
      storageArea: localStorage,
      url: window.location.href,
    }),
  );
}
