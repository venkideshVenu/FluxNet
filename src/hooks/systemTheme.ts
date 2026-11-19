import { listen } from "@/api";
import { subscribeSystemTheme } from "@/utils/theme";

/** Calls `onChange` when Windows switches apps between light and dark. */
export function onSystemThemeChange(onChange: () => void): () => void {
  return subscribeSystemTheme(onChange, (event, handler) =>
    listen<unknown>(event, (e) => handler(e.payload)),
  );
}
