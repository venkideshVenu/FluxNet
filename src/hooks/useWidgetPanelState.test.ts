import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWidgetPanelState } from "./useWidgetPanelState";
import { WIDGET_REGISTRY } from "@/config";

type Handler = (event: {
  payload: { label: string; visible: boolean };
}) => void;

const invokeMock = vi.fn();
const unlistenMock = vi.fn();
let handler: Handler | null = null;

vi.mock("@/api", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  listen: vi.fn(async (_event: string, cb: Handler) => {
    handler = cb;
    return unlistenMock;
  }),
  WIDGET_VISIBILITY_EVENT: "widget-visibility-changed",
}));

const config = WIDGET_REGISTRY.pill;

function emit(label: string, visible: boolean) {
  act(() => handler?.({ payload: { label, visible } }));
}

describe("useWidgetPanelState visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    unlistenMock.mockReset();
    handler = null;
  });

  it("initialises from the backend", async () => {
    invokeMock.mockResolvedValue(true);
    const { result } = renderHook(() => useWidgetPanelState(config));
    expect(result.current.visible).toBeNull();
    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(invokeMock).toHaveBeenCalledWith("get_widget_visibility", {
      label: "pill",
    });
  });

  it("falls back to hidden when the backend read fails", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useWidgetPanelState(config));
    await waitFor(() => expect(result.current.visible).toBe(false));
  });

  it("follows change events for its own widget only", async () => {
    invokeMock.mockResolvedValue(true);
    const { result } = renderHook(() => useWidgetPanelState(config));
    await waitFor(() => expect(result.current.visible).toBe(true));

    emit("hud", false);
    expect(result.current.visible).toBe(true);

    emit("pill", false); // e.g. turned off from the tray
    expect(result.current.visible).toBe(false);
  });

  it("toggles from the current value", async () => {
    invokeMock.mockResolvedValue(false);
    const { result } = renderHook(() => useWidgetPanelState(config));
    await waitFor(() => expect(result.current.visible).toBe(false));

    invokeMock.mockResolvedValue(undefined);
    await act(() => result.current.toggleVisible());
    expect(result.current.visible).toBe(true);
    expect(invokeMock).toHaveBeenLastCalledWith("set_widget_visibility", {
      label: "pill",
      visible: true,
    });
  });

  it("does nothing while visibility is still unknown", async () => {
    invokeMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useWidgetPanelState(config));
    await act(() => result.current.toggleVisible());
    expect(invokeMock).not.toHaveBeenCalledWith(
      "set_widget_visibility",
      expect.anything(),
    );
  });

  it("rolls back when the toggle fails", async () => {
    invokeMock.mockResolvedValue(true);
    const { result } = renderHook(() => useWidgetPanelState(config));
    await waitFor(() => expect(result.current.visible).toBe(true));

    invokeMock.mockRejectedValue(new Error("failed"));
    await act(() => result.current.toggleVisible());
    expect(result.current.visible).toBe(true);
  });

  it("unsubscribes on unmount", async () => {
    invokeMock.mockResolvedValue(true);
    const { unmount } = renderHook(() => useWidgetPanelState(config));
    await waitFor(() => expect(handler).not.toBeNull());
    unmount();
    expect(unlistenMock).toHaveBeenCalled();
  });

  it("uses the default opacity when the stored value is not a number", () => {
    invokeMock.mockReturnValue(new Promise(() => {}));
    localStorage.setItem(config.opacityKey, "abc");
    const { result } = renderHook(() => useWidgetPanelState(config));
    expect(result.current.opacity).toBe(config.defaultOpacity);
  });
});
