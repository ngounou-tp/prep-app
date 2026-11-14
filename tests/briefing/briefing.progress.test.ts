import { afterEach, describe, expect, it, vi } from "vitest";
import { createBriefing } from "@/lib/briefing/briefing";
import { HUB_CONTENT, HUB_QUOTE, HUB_URL, HUB_WIRE_URL, meeting, NOW, stubBriefingNetwork } from "@/tests/support/briefingScenario";
import { chatRequestsSent, jsonResponse, makeSubject, recordingPause, tavilyResult, TEST_ENVIRONMENT_SOURCE } from "@/tests/support/testDoubles";
import type { ProgressEvent } from "@/lib/types";

const northwind = makeSubject("c1", "Northwind Freight", "company");
const jonas = makeSubject("p2", "Jonas Weber", "person", { company: "Harbor Capital" });
const FUND_URL = "https://wire.example/harbor-fund";

const results = {
  "Northwind Freight": [
    tavilyResult(HUB_URL, { content: HUB_CONTENT, published_date: "2026-10-21", score: 0.9 }),
    tavilyResult(HUB_WIRE_URL, { content: "Northwind opened its Rotterdam hub.", published_date: null }),
  ],
  "Jonas Weber": [tavilyResult(FUND_URL, { content: "Jonas Weber leads its logistics deals at Harbor Capital.", published_date: "2026-10-29" })],
};
const claims = {
  "Northwind Freight": [{ text: "Opened a cold-chain hub in Rotterdam.", quote: HUB_QUOTE, urls: [HUB_URL, HUB_WIRE_URL] }],
  "Jonas Weber": [{ text: "Leads logistics deals.", quote: "Jonas Weber leads its logistics deals", urls: [FUND_URL] }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBriefing progress", () => {
  it("emits searching, sources, checking, writing and done, in that order", async () => {
    stubBriefingNetwork({ results, claims });
    const events: ProgressEvent[] = [];
    await createBriefing(meeting([northwind, jonas]), NOW, {
      environmentSource: TEST_ENVIRONMENT_SOURCE,
      pause: recordingPause().pause,
      onProgress: (event) => events.push(event),
    });
    expect(events.map((event) => event.type)).toEqual([
      "searching",
      "searching",
      "sources",
      "sources",
      "extracted",
      "extracted",
      "checking",
      "checking",
      "writing",
      "done",
    ]);
    expect(events[0]).toEqual({ type: "searching", subjectId: "c1", queryCount: 3 });
    expect(events[2]).toEqual({ type: "sources", subjectId: "c1", count: 2, sourceIds: ["S1", "S2"], publishedDates: ["2026-10-21", null] });
    expect(events[4]).toEqual({ type: "extracted", subjectId: "c1", outcome: "ok", claimCount: 1 });
    expect(events[6]).toEqual({
      type: "checking",
      subjectIds: ["c1"],
      checked: 1,
      total: 2,
      claim: { text: "Opened a cold-chain hub in Rotterdam.", status: "verified" },
      checks: { quoteSourceId: "S1", quoteDomain: "news.example", publishedDate: "2026-10-21", secondSourceId: "S2" },
    });
    expect(events[7]).toMatchObject({ type: "checking", subjectIds: ["p2"], checked: 2, total: 2, claim: { status: "single-source" } });
    expect(events[7]).toMatchObject({ checks: { secondSourceId: null } });
  });

  it("announces a rate-limit retry for the subject it affects", async () => {
    stubBriefingNetwork({
      results,
      claims,
      failExtraction: (name) => (name === "Jonas Weber" ? jsonResponse({ extra_fields: { retry_after_ms: 8000 } }, 429) : undefined),
    });
    const events: ProgressEvent[] = [];
    await createBriefing(meeting([northwind, jonas]), NOW, {
      environmentSource: TEST_ENVIRONMENT_SOURCE,
      pause: recordingPause().pause,
      onProgress: (event) => events.push(event),
    });
    expect(events).toContainEqual({ type: "retrying", subjectId: "p2", waitSeconds: 8 });
    expect(events).toContainEqual({ type: "extracted", subjectId: "p2", outcome: "rate-limit", claimCount: 0 });
  });

  it("never puts source content or URLs in an event, only ids and domains", async () => {
    stubBriefingNetwork({ results, claims });
    const events: ProgressEvent[] = [];
    await createBriefing(meeting([northwind]), NOW, { environmentSource: TEST_ENVIRONMENT_SOURCE, onProgress: (event) => events.push(event) });
    const text = JSON.stringify(events);
    expect(text).not.toContain(HUB_CONTENT);
    expect(text).not.toContain("https://");
    expect(text).not.toContain("test-key-not-real");
  });
});

describe("createBriefing time budget", () => {
  it("stops starting new work near the limit, verifies what exists and marks the rest not completed", async () => {
    let now = 0;
    stubBriefingNetwork({ results, claims });
    const fetchMock = vi.mocked(fetch);
    const answer = fetchMock.getMockImplementation();
    // The first extraction takes 40 of the 55 seconds, so no second extraction may start.
    fetchMock.mockImplementation(async (input, init) => {
      const response = await answer?.(input, init);
      if (String(input).includes("bifrost") && now === 0) {
        now = 40_000;
      }
      return response ?? new Response(null, { status: 500 });
    });
    const briefing = await createBriefing(meeting([northwind, jonas]), NOW, {
      environmentSource: TEST_ENVIRONMENT_SOURCE,
      clock: () => now,
      pause: recordingPause().pause,
    });
    expect(briefing.subjects[0]?.note).toBeNull();
    expect(briefing.subjects[1]?.note).toMatchObject({ kind: "not-completed", message: expect.stringContaining("Not finished.") });
    expect(briefing.claims.map((claim) => claim.subjectIds)).toEqual([["c1"]]);
    expect(chatRequestsSent(fetchMock)).toHaveLength(2);
    expect(briefing.snapshot).not.toBeNull();
  });

  it("stops work when the client disconnects", async () => {
    const disconnect = new AbortController();
    stubBriefingNetwork({ results, claims });
    const fetchMock = vi.mocked(fetch);
    const answer = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      disconnect.abort();
      return (await answer?.(input, init)) ?? new Response(null, { status: 500 });
    });
    const briefing = await createBriefing(meeting([northwind, jonas]), NOW, {
      environmentSource: TEST_ENVIRONMENT_SOURCE,
      signal: disconnect.signal,
      pause: recordingPause().pause,
    });
    expect(chatRequestsSent(fetchMock)).toHaveLength(0);
    expect(briefing.subjects.every((section) => section.note?.kind === "not-completed")).toBe(true);
  });
});
