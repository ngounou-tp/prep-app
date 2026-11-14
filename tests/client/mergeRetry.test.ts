import { describe, expect, it } from "vitest";
import { mergeRetry } from "@/lib/client/mergeRetry";
import { buildBriefing, company, fixtureClaim, fixtureSource, person } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");
const jonas = person("p2", "Jonas Weber", "Harbor Capital");

describe("mergeRetry", () => {
  const current = buildBriefing({
    subjects: [northwind, jonas],
    claims: [fixtureClaim("C1", ["c1"]), fixtureClaim("C2", ["c1"], { date: "2026-10-30" })],
    outcomes: { p2: "not-completed" },
  });
  const fundSource = fixtureSource("S1", ["p2"], { url: "https://wire.example/harbor-fund", domain: "wire.example" });
  const retry = buildBriefing({ subjects: [jonas], claims: [fixtureClaim("C1", ["p2"], { text: "Leads logistics deals.", sources: [fundSource] })] });
  const merged = mergeRetry(current, retry, "p2");

  it("leaves every other subject's section, claims and sources exactly as they were", () => {
    expect(merged.subjects[0]).toEqual(current.subjects[0]);
    expect(merged.claims.filter((claim) => claim.subjectIds.includes("c1"))).toEqual(current.claims);
    expect(merged.sources.slice(0, current.sources.length)).toEqual(current.sources);
  });

  it("renumbers the retried subject's claims and sources after the current ones", () => {
    const added = merged.claims.find((claim) => claim.subjectIds.includes("p2"));
    expect(added).toMatchObject({ id: "C3", sourceIds: ["S3"], quoteSourceId: "S3" });
    expect(merged.subjects[1]).toMatchObject({ subjectId: "p2", shownClaimIds: ["C3"], note: null });
    expect(new Set(merged.claims.map((claim) => claim.id)).size).toBe(merged.claims.length);
    expect(merged.counts.verified).toBe(3);
  });

  it("reuses the id of a source the briefing already has", () => {
    const sameUrl = buildBriefing({ subjects: [jonas], claims: [fixtureClaim("C1", ["p2"], { sources: [fixtureSource("S1", ["p2"])] })] });
    const result = mergeRetry(current, sameUrl, "p2");
    expect(result.claims.at(-1)?.sourceIds).toEqual(["S1"]);
    expect(result.sources.find((source) => source.id === "S1")?.subjectIds).toEqual(["c1", "p2"]);
  });
});
