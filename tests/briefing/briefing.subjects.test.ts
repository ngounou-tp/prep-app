import { afterEach, describe, expect, it, vi } from "vitest";
import { createBriefing } from "@/lib/briefing/briefing";
import { HUB_CONTENT, HUB_QUOTE, HUB_URL, HUB_WIRE_URL, meeting, NOW, stubBriefingNetwork } from "@/tests/support/briefingScenario";
import { chatRequestsSent, completion, jsonResponse, makeSubject, recordingPause, tavilyResult, TEST_ENVIRONMENT_SOURCE } from "@/tests/support/testDoubles";

const northwind = makeSubject("c1", "Northwind Freight", "company");
const amara = makeSubject("p1", "Amara Diallo", "person", { company: "Northwind Freight" });
const jonas = makeSubject("p2", "Jonas Weber", "person", { company: "Harbor Capital" });

const CFO_URL = "https://news.example/northwind-finance-chief";
const CFO_CONTENT = "Northwind Freight named Amara Diallo as its chief financial officer, effective 3 November.";
const CFO_QUOTE = "Northwind Freight named Amara Diallo as its chief financial officer";
const FUND_URL = "https://wire.example/harbor-fund";
const FUND_CONTENT = "Harbor Capital closed a new fund for supply-chain companies, and Jonas Weber leads its logistics deals.";

const results = {
  "Northwind Freight": [
    tavilyResult(HUB_URL, { content: HUB_CONTENT, published_date: "2026-10-21", score: 0.9 }),
    tavilyResult(HUB_WIRE_URL, { content: "Northwind opened its Rotterdam hub.", published_date: "2026-10-22" }),
    tavilyResult(CFO_URL, { content: CFO_CONTENT, published_date: "2026-11-03", score: 0.8 }),
  ],
  "Amara Diallo": [
    tavilyResult(CFO_URL, { content: CFO_CONTENT, published_date: "2026-11-03", score: 0.8 }),
    tavilyResult("https://wire.example/finance-chief", { content: "A new finance chief at Northwind.", published_date: "2026-11-04" }),
  ],
  "Jonas Weber": [tavilyResult(FUND_URL, { content: FUND_CONTENT, published_date: "2026-10-29" })],
};

const claims = {
  "Northwind Freight": [
    { text: "Opened a cold-chain hub in Rotterdam.", quote: HUB_QUOTE, urls: [HUB_URL, HUB_WIRE_URL] },
    { text: "Named a new finance chief.", quote: CFO_QUOTE, urls: [CFO_URL] },
  ],
  "Amara Diallo": [{ text: "Named chief financial officer.", quote: CFO_QUOTE, urls: [CFO_URL, "https://wire.example/finance-chief"] }],
  "Jonas Weber": [{ text: "Leads logistics deals for a new fund.", quote: "Jonas Weber leads its logistics deals", urls: [FUND_URL] }],
};

function run(subjects = [northwind, amara, jonas]) {
  const { pause, waits } = recordingPause();
  return { waits, briefing: createBriefing(meeting(subjects), NOW, { environmentSource: TEST_ENVIRONMENT_SOURCE, pause }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBriefing for several subjects", () => {
  it("groups the person under their company and merges the claim both found into one shared claim", async () => {
    stubBriefingNetwork({ results, claims });
    const briefing = await run().briefing;
    expect(briefing.groups).toEqual([
      { companyName: "Northwind Freight", companySubjectId: "c1", personSubjectIds: ["p1"] },
      { companyName: "Harbor Capital", companySubjectId: null, personSubjectIds: ["p2"] },
    ]);
    const shared = briefing.claims.filter((claim) => claim.subjectIds.length > 1);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ subjectIds: ["c1", "p1"], status: "verified" });
    expect(briefing.sharedClaimIds).toEqual([shared[0]?.id]);
  });

  it("makes at most one model call per subject plus one", async () => {
    const fetchMock = stubBriefingNetwork({ results, claims });
    await run().briefing;
    expect(chatRequestsSent(fetchMock)).toHaveLength(4);
  });

  it("shows one subject empty and another full", async () => {
    stubBriefingNetwork({ results: { "Northwind Freight": results["Northwind Freight"] }, claims });
    const briefing = await run([northwind, jonas]).briefing;
    const [full, empty] = briefing.subjects;
    expect(full?.shownClaimIds.length).toBeGreaterThan(0);
    expect(full?.note).toBeNull();
    expect(empty).toMatchObject({ shownClaimIds: [], line: null, note: { kind: "nothing-found" } });
  });

  it("keeps the briefing when one subject's extraction fails", async () => {
    stubBriefingNetwork({ results, claims, failExtraction: (name) => (name === "Jonas Weber" ? jsonResponse({}, 500) : undefined) });
    const briefing = await run().briefing;
    expect(briefing.subjects.map((section) => section.note?.kind ?? null)).toEqual([null, null, "model-failed"]);
    expect(briefing.subjects[2]?.note?.message).toBe("We found 1 source but could not check them. Nothing about this subject is shown until it is checked.");
    expect(briefing.snapshot).not.toBeNull();
  });

  it("fails only the rate-limited subject, after one wait and one retry", async () => {
    const limited = () => jsonResponse({ extra_fields: { retry_after_ms: 2000 } }, 429);
    const fetchMock = stubBriefingNetwork({ results, claims, failExtraction: (name) => (name === "Amara Diallo" ? limited() : undefined) });
    const { briefing, waits } = run();
    const result = await briefing;
    expect(result.subjects[1]?.note).toMatchObject({ kind: "model-rate-limit", message: expect.stringContaining("Model rate limit") });
    expect(result.subjects[0]?.note).toBeNull();
    expect(waits).toContain(2000);
    expect(chatRequestsSent(fetchMock)).toHaveLength(5);
  });

  it("tolerates a model reply wrapped in prose without failing the subject", async () => {
    stubBriefingNetwork({
      results,
      claims,
      failExtraction: (name) => (name === "Jonas Weber" ? completion('Sure. {"claims": []} Let me know if you need more.') : undefined),
    });
    const briefing = await run().briefing;
    expect(briefing.subjects[2]?.note?.kind).toBe("nothing-found");
  });
});
