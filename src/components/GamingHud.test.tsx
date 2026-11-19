import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { GamingHud } from "./GamingHud";
import { LS_HUD_DESIGN } from "@/utils";

vi.mock("@/hooks", () => ({
  usePingPoller: vi.fn(),
  useDragToMove: () => vi.fn(),
  useKeyboardNudge: () => vi.fn(),
  useFitWindow: () => ({ current: null }),
}));

const invokeMock = vi.mocked(invoke);

/** Vertical layout renders units separately; horizontal inlines them. */
function isVertical() {
  return screen.queryAllByText("B/s").length > 0;
}

describe("GamingHud design", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    delete (window as { __FLUXNET_HUD_DESIGN?: unknown }).__FLUXNET_HUD_DESIGN;
  });

  it("renders the cached design on the first frame", () => {
    localStorage.setItem(LS_HUD_DESIGN, "vertical");
    invokeMock.mockReturnValue(new Promise(() => {})); // backend never answers
    render(<GamingHud />);
    expect(isVertical()).toBe(true);
  });

  it("applies and caches the backend design", async () => {
    invokeMock.mockResolvedValue("vertical");
    render(<GamingHud />);
    await waitFor(() => expect(isVertical()).toBe(true));
    expect(localStorage.getItem(LS_HUD_DESIGN)).toBe("vertical");
  });

  it("ignores an invalid backend value", async () => {
    localStorage.setItem(LS_HUD_DESIGN, "vertical");
    invokeMock.mockResolvedValue("diagonal");
    render(<GamingHud />);
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(isVertical()).toBe(true);
    expect(localStorage.getItem(LS_HUD_DESIGN)).toBe("vertical");
  });

  it("follows design-changed events and ignores invalid ones", async () => {
    invokeMock.mockResolvedValue("horizontal");
    render(<GamingHud />);
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(isVertical()).toBe(false);

    act(() => {
      (window as { __FLUXNET_HUD_DESIGN?: unknown }).__FLUXNET_HUD_DESIGN =
        "vertical";
      window.dispatchEvent(new Event("fluxnet_hud_design_changed"));
    });
    expect(isVertical()).toBe(true);

    act(() => {
      (window as { __FLUXNET_HUD_DESIGN?: unknown }).__FLUXNET_HUD_DESIGN =
        "bogus";
      window.dispatchEvent(new Event("fluxnet_hud_design_changed"));
    });
    expect(isVertical()).toBe(true);
  });
});
