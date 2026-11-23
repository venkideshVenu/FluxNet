import { describe, it, expect } from "vitest";
import { toPhysicalSize } from "./useFitWindow";

describe("toPhysicalSize", () => {
  it("scales the measured size to screen pixels, rounding up", () => {
    expect(toPhysicalSize(220, 28, 1)).toEqual({
      physicalWidth: 220,
      physicalHeight: 28,
    });
    expect(toPhysicalSize(220, 28, 1.25)).toEqual({
      physicalWidth: 275,
      physicalHeight: 35,
    });
    expect(toPhysicalSize(219.4, 27.2, 1.5)).toEqual({
      physicalWidth: 330,
      physicalHeight: 41,
    });
  });

  it("treats a missing or broken scale as 1", () => {
    expect(toPhysicalSize(100, 20, 0)).toEqual({
      physicalWidth: 100,
      physicalHeight: 20,
    });
    expect(toPhysicalSize(100, 20, Number.NaN).physicalWidth).toBe(100);
  });
});
