import { describe, expect, it } from "vitest";
import { developmentsFor, groupLayout, isEmptyBriefing, missingSubjects, safeHref, visibleDevelopmentIds } from "@/lib/client/briefingView";
import { buildBriefing, company, fixtureClaim, person } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");
const amara = person("p1", "Amara Diallo", "Northwind Freight");
const jonas = person("p2", "Jonas Weber", "Harbor Capital");

describe("briefing view model", () => {
  it("nests a person under their company when it is a subject; others are top level", () => {
    expect(groupLayout(buildBriefing({ subjects: [northwind, amara, jonas] }))).toEqual([
      { subjectId: "c1", nested: false },
      { subjectId: "p1", nested: true },
      { subjectId: "p2", nested: false },
    ]);
  });

  it("lists a shared claim once, under the person, newest first", () => {
    const briefing = buildBriefing({
      subjects: [northwind, amara],
      claims: [fixtureClaim("C1", ["c1", "p1"], { date: "2026-11-03" }), fixtureClaim("C2", ["c1"], { date: "2026-10-14" }), fixtureClaim("C3", ["c1"], { date: "2026-11-05" })],
    });
    expect(developmentsFor(briefing, "c1", false).map(({ claim }) => claim.id)).toEqual(["C3", "C2"]);
    expect(developmentsFor(briefing, "p1", false).map(({ claim }) => claim.id)).toEqual(["C1"]);
    expect(visibleDevelopmentIds(briefing, "p1", new Set())).toEqual(["C1"]);
  });

  it("knows an empty briefing from a partial one", () => {
    expect(isEmptyBriefing(buildBriefing({ subjects: [northwind] }))).toBe(true);
    const partial = buildBriefing({ subjects: [northwind, jonas], claims: [fixtureClaim("C1", ["c1"])], outcomes: { p2: "not-completed" } });
    expect(isEmptyBriefing(partial)).toBe(false);
    expect(missingSubjects(partial).map(({ subjectId, note }) => [subjectId, note.kind])).toEqual([["p2", "not-completed"]]);
  });

  it("makes links only from http and https addresses", () => {
    expect(safeHref("https://news.example/a")).toBe("https://news.example/a");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });
});
