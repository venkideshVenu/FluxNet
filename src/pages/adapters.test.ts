import { describe, it, expect } from "vitest";
import { typeLabel } from "./InterfacesPage";

describe("typeLabel", () => {
  it("labels adapter types in plain words", () => {
    expect(typeLabel("wifi")).toBe("Wi-Fi");
    expect(typeLabel("usb")).toBe("USB tethering");
    expect(typeLabel("mystery")).toBe("Other");
  });
});
