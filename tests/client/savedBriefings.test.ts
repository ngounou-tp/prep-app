import { describe, expect, it } from "vitest";
import { MAX_SAVED_BRIEFINGS, newestFirst, summarize, validSaved } from "@/lib/client/savedBriefings";
import { buildBriefing, company, fixtureClaim, person } from "@/tests/support/briefingFixture";

const briefing = buildBriefing({ subjects: [company("c1", "Northwind Freight"), person("p1", "Amara Diallo")], claims: [fixtureClaim("C1", ["c1"])] });

describe("saved briefings", () => {
  it("summarises a saved briefing for the list", () => {
    expect(summarize({ id: "a", savedAt: "2026-11-12T10:00:00.000Z", briefing })).toEqual({
      id: "a",
      savedAt: "2026-11-12T10:00:00.000Z",
      meetingAt: "2026-11-19T10:00:00.000Z",
      title: "Sales call",
      subjects: "Northwind Freight, Amara Diallo",
      findings: 1,
    });
  });

  it("keeps the newest 30 and names the rest to delete", () => {
    const saved = Array.from({ length: MAX_SAVED_BRIEFINGS + 2 }, (_, index) => ({
      id: `id-${index}`,
      savedAt: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(),
      briefing,
    }));
    const { keep, drop } = newestFirst(saved);
    expect(keep).toHaveLength(MAX_SAVED_BRIEFINGS);
    expect(keep[0]?.id).toBe(`id-${MAX_SAVED_BRIEFINGS + 1}`);
    expect(drop).toEqual(["id-1", "id-0"]);
  });

  it("ignores stored entries that no longer match the briefing schema", () => {
    expect(validSaved({ id: "a", savedAt: "2026-11-12T10:00:00.000Z", briefing })).not.toBeNull();
    expect(validSaved({ id: "a", savedAt: "2026-11-12T10:00:00.000Z", briefing: { old: true } })).toBeNull();
    expect(validSaved("nonsense")).toBeNull();
  });
});
