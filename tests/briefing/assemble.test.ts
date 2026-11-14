import { describe, expect, it } from "vitest";
import { assembleBriefing, type SubjectExtraction } from "@/lib/briefing/assemble";
import { groupSubjects, selectForPage } from "@/lib/briefing/pageBudget";
import { makeSubject, TEST_WINDOW } from "@/tests/support/testDoubles";
import type { ClaimStatus, Source, VerifiedClaim } from "@/lib/types";

const northwind = makeSubject("c1", "Northwind Freight", "company");
const amara = makeSubject("p1", "Amara Diallo", "person", { company: "northwind  freight" });
const jonas = makeSubject("p2", "Jonas Weber", "person", { company: "Harbor Capital" });
const lena = makeSubject("p3", "Lena Ortiz", "person", { company: "Harbor Capital" });
const solo = makeSubject("p4", "Sam Reyes", "person");

const SOURCE: Source = {
  id: "S1",
  title: "Example headline",
  url: "https://news.example/S1",
  domain: "news.example",
  content: "Example content.",
  publishedDate: "2026-10-21",
  score: 0.5,
  subjectIds: ["c1"],
};

let nextId = 1;
function verified(subjectIds: string[], status: ClaimStatus, date: string): VerifiedClaim {
  const id = `C${nextId++}`;
  return { id, text: `Claim ${id}`, category: "news", date, sourceIds: ["S1"], quote: "example", subjectIds, status, quoteSourceId: "S1", sources: [SOURCE] };
}

describe("groupSubjects", () => {
  it("groups people under their company when it is a subject, matching names loosely", () => {
    expect(groupSubjects([amara, northwind])[0]).toEqual({ companyName: "Northwind Freight", companySubjectId: "c1", personSubjectIds: ["p1"] });
  });

  it("groups people under a named company that is not a subject, and leaves a person without one alone", () => {
    expect(groupSubjects([jonas, lena, solo])).toEqual([
      { companyName: "Harbor Capital", companySubjectId: null, personSubjectIds: ["p2", "p3"] },
      { companyName: null, companySubjectId: null, personSubjectIds: ["p4"] },
    ]);
  });
});

describe("selectForPage", () => {
  it("gives every subject with findings a place, then fills to 8 by status and recency", () => {
    const busy = Array.from({ length: 10 }, (_, index) => verified(["c1"], "verified", `2026-11-${String(10 - index).padStart(2, "0")}`));
    const quiet = verified(["p2"], "single-source", "2026-10-13");
    const unconfirmedOnly = verified(["p3"], "unconfirmed", "2026-11-01");
    const chosen = selectForPage([...busy, quiet, unconfirmedOnly], [northwind, jonas, lena]);
    expect(chosen.size).toBe(8);
    expect(chosen.has(quiet.id)).toBe(true);
    expect(chosen.has(unconfirmedOnly.id)).toBe(false);
    expect([...chosen].filter((id) => busy.some((claim) => claim.id === id))).toEqual(busy.slice(0, 7).map((claim) => claim.id));
  });
});

function extraction(subjectId: string, outcome: SubjectExtraction["outcome"]): SubjectExtraction {
  return { subjectId, outcome, modelCall: null };
}

describe("assembleBriefing", () => {
  const input = { meetingAt: "2026-11-19T10:00:00Z", meetingType: "sales-call" as const, meetingTopic: undefined, subjects: [northwind, amara, jonas] };
  const base = { input, searchWindow: TEST_WINDOW, now: new Date("2026-11-11T08:00:00Z") };

  it("writes an honest empty snapshot and a nothing-found note when no call was made", () => {
    const result = assembleBriefing({
      ...base,
      research: { sources: [], failedSubjectIds: [], unfinishedSubjectIds: [], searchesRun: 5 },
      extractions: input.subjects.map((subject) => extraction(subject.id, "no-sources")),
      claims: [],
      writing: { skipped: true, written: null, modelCall: null },
    });
    expect(result.snapshot).toBe("Nothing significant between 12 Oct and 11 Nov. No development in this period could be confirmed from its sources.");
    expect(result.subjects.map((section) => section.note?.kind)).toEqual(["nothing-found", "nothing-found", "nothing-found"]);
    expect(result.window).toEqual({ startDate: "2026-10-12", lastDate: "2026-11-11", endDate: "2026-11-12" });
  });

  it("reports each failure on its own subject and keeps the rest", () => {
    const shared = verified(["c1", "p1"], "verified", "2026-11-03");
    const result = assembleBriefing({
      ...base,
      research: { sources: [{ ...SOURCE, subjectIds: ["c1", "p1", "p2"] }], failedSubjectIds: [], unfinishedSubjectIds: [], searchesRun: 5 },
      extractions: [extraction("c1", "ok"), extraction("p1", "ok"), extraction("p2", "rate-limit")],
      claims: [shared],
      writing: {
        skipped: false,
        written: {
          snapshot: "One development.",
          subjectLines: [{ subjectId: "c1", line: "Line." }],
          questions: [{ text: "Kept?", claimId: shared.id }, { text: "Dropped?", claimId: "C999" }],
          openQuestions: [{ text: "What would make this worth it for you?" }, { text: "How did the merger with Acme Corp go?" }, { text: "Who signs off in 2027?" }],
        },
        modelCall: null,
      },
    });
    expect(result.subjects.map((section) => section.note?.kind ?? null)).toEqual([null, null, "model-rate-limit"]);
    expect(result.subjects[2]?.note?.message).toContain("Model rate limit");
    expect(result.subjects[1]?.shownClaimIds).toEqual([shared.id]);
    expect(result.sharedClaimIds).toEqual([shared.id]);
    expect(result.questions).toEqual([{ text: "Kept?", claimId: shared.id, subjectIds: ["c1", "p1"] }]);
    expect(result.openQuestions).toEqual(["What would make this worth it for you?"]);
  });
});
