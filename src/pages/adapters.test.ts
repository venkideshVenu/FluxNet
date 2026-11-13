import { describe, it, expect } from "vitest";
import { pickAutomatic, typeLabel, type InterfaceInfo } from "./InterfacesPage";

const adapter = (name: string, type: string, status = "Up"): InterfaceInfo => ({
  name,
  description: name,
  if_index: 1,
  status,
  mac: "",
  link_speed_bps: 0,
  interface_type: type,
});

describe("pickAutomatic", () => {
  it("prefers a connected Ethernet or Wi-Fi adapter over virtual ones", () => {
    const list = [adapter("vEthernet (WSL)", "virtual"), adapter("Wi-Fi", "wifi")];
    expect(pickAutomatic(list)?.name).toBe("Wi-Fi");
  });

  it("falls back to any connected adapter, and to none", () => {
    expect(pickAutomatic([adapter("Phone", "usb")])?.name).toBe("Phone");
    expect(pickAutomatic([adapter("Wi-Fi", "wifi", "Disconnected")])).toBeUndefined();
  });

  it("labels adapter types in plain words", () => {
    expect(typeLabel("wifi")).toBe("Wi-Fi");
    expect(typeLabel("usb")).toBe("USB tethering");
    expect(typeLabel("mystery")).toBe("Other");
  });
});
