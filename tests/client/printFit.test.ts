import { describe, expect, it } from "vitest";
import { MIN_PRINT_SCALE, PRINT_AREA, printScale } from "@/lib/client/printFit";

describe("printScale", () => {
  it("leaves a report that fits alone", () => {
    expect(printScale(0)).toBe(1);
    expect(printScale(PRINT_AREA.height * 0.9)).toBe(1);
  });

  it("shrinks a slightly long report just enough, rounded down", () => {
    expect(printScale(1100, 1000)).toBe(0.88);
    expect(printScale(1100, 1000) * 1100).toBeLessThanOrEqual(1000);
  });

  it("stops shrinking at a size that is still readable", () => {
    expect(printScale(5000, 1000)).toBe(MIN_PRINT_SCALE);
  });

  it("uses an A4 page with 12mm margins by default", () => {
    expect(Math.round(PRINT_AREA.width)).toBe(703);
    expect(Math.round(PRINT_AREA.height)).toBe(1032);
  });
});
