import { describe, expect, it } from "vitest";
import { researchWindow } from "@/lib/research/window";

const NOW = new Date("2026-11-11T08:00:00Z");

describe("researchWindow", () => {
  it("ends now and starts 30 days earlier when the meeting is in the future", () => {
    const window = researchWindow("2026-11-19T10:00:00Z", NOW);
    expect(window.end.toISOString()).toBe("2026-11-11T08:00:00.000Z");
    expect(window.start.toISOString()).toBe("2026-10-12T08:00:00.000Z");
    expect(window.startDate).toBe("2026-10-12");
    expect(window.endDate).toBe("2026-11-12");
  });

  it("ends at the meeting when the meeting is in the past", () => {
    const window = researchWindow("2026-10-01T09:30:00Z", NOW);
    expect(window.end.toISOString()).toBe("2026-10-01T09:30:00.000Z");
    expect(window.startDate).toBe("2026-09-01");
    expect(window.endDate).toBe("2026-10-02");
  });

  it("crosses a month boundary for both dates", () => {
    const window = researchWindow("2026-03-20T10:00:00Z", new Date("2026-03-01T12:00:00Z"));
    expect(window.startDate).toBe("2026-01-30");
    expect(window.endDate).toBe("2026-03-02");
  });

  it("rolls endDate into the next month when the window ends on the last day", () => {
    const window = researchWindow("2026-11-01T00:30:00+02:00", NOW);
    expect(window.end.toISOString()).toBe("2026-10-31T22:30:00.000Z");
    expect(window.startDate).toBe("2026-10-01");
    expect(window.endDate).toBe("2026-11-01");
  });

  it("rejects a meeting time that is not a date", () => {
    expect(() => researchWindow("next Tuesday", NOW)).toThrow(RangeError);
  });
});
