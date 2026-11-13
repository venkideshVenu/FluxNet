import { describe, it, expect, vi, beforeEach } from "vitest";
import { pollNetworkData } from "./networkApi";

const invokeMock = vi.fn();
vi.mock("@/utils", () => ({
  invokeWithTimeout: (...args: unknown[]) => invokeMock(...args),
}));

const stats = {
  upload_bytes_per_sec: 10,
  download_bytes_per_sec: 20,
  interface_name: "Wi-Fi",
};

const snapshot = {
  current_upload: 1,
  current_download: 2,
  peak_upload: 3,
  peak_download: 4,
  interface_name: "Ethernet",
  is_connected: true,
  history: [{ upload: 1, download: 2, t: 3 }],
};

describe("pollNetworkData", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === "get_network_stats" ? stats : snapshot,
    );
  });

  it.each(["pill", "compact", "hud"])(
    "%s widget uses the light stats call",
    async (label) => {
      const result = await pollNetworkData(label);
      expect(invokeMock).toHaveBeenCalledWith("get_network_stats");
      expect(invokeMock).not.toHaveBeenCalledWith("get_dashboard_snapshot");
      expect(result.snapshot).toBeUndefined();
      expect(result.liveData).toEqual({
        uploadBytesPerSec: 10,
        downloadBytesPerSec: 20,
        interfaceName: "Wi-Fi",
      });
    },
  );

  it("dashboard uses the full snapshot", async () => {
    const result = await pollNetworkData("main");
    expect(invokeMock).toHaveBeenCalledWith("get_dashboard_snapshot");
    expect(result.liveData).toBeUndefined();
    expect(result.snapshot).toEqual({
      peakUpload: 3,
      peakDownload: 4,
      interfaceName: "Ethernet",
      isConnected: true,
      history: snapshot.history,
    });
  });
});
