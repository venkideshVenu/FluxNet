import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStoredInterval } from "./useStoredInterval";
import { clampPollInterval } from "@/utils";

let mockWindowLabel = "pill";
vi.mock("@/api", () => ({
  get WINDOW_LABEL() {
    return mockWindowLabel;
  },
}));

const KEY = "fluxnet_pill_interval_ms";

function fireStorage(key: string) {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
}

describe("useStoredInterval", () => {
  let stored = 1000;
  const getStored = () => stored;

  beforeEach(() => {
    stored = 1000;
    mockWindowLabel = "pill";
  });

  it("returns the stored value", () => {
    const { result } = renderHook(() =>
      useStoredInterval("pill", KEY, getStored),
    );
    expect(result.current).toBe(1000);
  });

  it("reacts to its own key in its own window", () => {
    const { result } = renderHook(() =>
      useStoredInterval("pill", KEY, getStored),
    );
    stored = 2000;
    fireStorage("some_other_key");
    expect(result.current).toBe(1000);
    fireStorage(KEY);
    expect(result.current).toBe(2000);
  });

  it("ignores changes when rendered in another window", () => {
    mockWindowLabel = "hud";
    const { result } = renderHook(() =>
      useStoredInterval("pill", KEY, getStored),
    );
    stored = 2000;
    fireStorage(KEY);
    expect(result.current).toBe(1000);
  });

  it.each([
    [0, 500],
    [-100, 500],
    [100_000, 5000],
    [NaN, 1000],
  ])("clamps stored %s to %s", (value, expected) => {
    stored = value;
    const { result } = renderHook(() =>
      useStoredInterval("pill", KEY, getStored),
    );
    expect(result.current).toBe(expected);
  });
});

describe("clampPollInterval", () => {
  it("keeps values in range untouched", () => {
    expect(clampPollInterval(2000)).toBe(2000);
  });
  it("uses the fallback for non-finite input", () => {
    expect(clampPollInterval(Infinity, 1500)).toBe(1500);
  });
});
