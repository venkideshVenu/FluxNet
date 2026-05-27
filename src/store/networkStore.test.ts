import { describe, it, expect, beforeEach } from "vitest";
import { useNetworkStore } from "./networkStore";

// Reset store state between tests
beforeEach(() => {
  useNetworkStore.setState({
    data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
    isConnected: false,
  });
});

describe("networkStore", () => {
  it("starts with zero data and disconnected", () => {
    const { data, isConnected } = useNetworkStore.getState();
    expect(data.uploadBytesPerSec).toBe(0);
    expect(data.downloadBytesPerSec).toBe(0);
    expect(isConnected).toBe(false);
  });

  it("setData updates values and marks connected", () => {
    const { setData } = useNetworkStore.getState();
    setData({
      uploadBytesPerSec: 1_000_000,
      downloadBytesPerSec: 5_000_000,
      interfaceName: "wlan0",
    });
    const { data, isConnected } = useNetworkStore.getState();
    expect(data.uploadBytesPerSec).toBe(1_000_000);
    expect(data.downloadBytesPerSec).toBe(5_000_000);
    expect(data.interfaceName).toBe("wlan0");
    expect(isConnected).toBe(true);
  });

  it("setConnected toggles connection flag", () => {
    const { setConnected } = useNetworkStore.getState();
    setConnected(false);
    expect(useNetworkStore.getState().isConnected).toBe(false);
    setConnected(true);
    expect(useNetworkStore.getState().isConnected).toBe(true);
  });
});
