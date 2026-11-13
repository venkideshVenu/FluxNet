import { invoke } from "./tauri";
import type { Appearance } from "@/utils";

/** Accent palette and backdrop material from the backend, or null if unavailable. */
export async function fetchAppearance(): Promise<Appearance | null> {
  try {
    return await invoke<Appearance>("get_appearance");
  } catch {
    return null;
  }
}
