import { afterEach, describe, expect, it, vi } from "vitest";
import { createBriefing } from "@/lib/briefing/briefing";
import { handleBriefingRequest, type BriefingRequestDependencies } from "@/lib/http/briefingRequest";
import { HUB_CONTENT, HUB_QUOTE, HUB_URL, HUB_WIRE_URL, meeting, NOW, stubBriefingNetwork } from "@/tests/support/briefingScenario";
import { createSubjectRateLimiter } from "@/lib/http/rateLimit";
import { jsonResponse, makeSubject, recordingPause, stubNetwork, tavilyResult, TEST_ENVIRONMENT_SOURCE } from "@/tests/support/testDoubles";
import { streamLineSchema, type BriefingInput, type StreamLine } from "@/lib/types";

const northwind = makeSubject("c1", "Northwind Freight", "company");
const jonas = makeSubject("p2", "Jonas Weber", "person", { company: "Harbor Capital" });
const hubResults = [
  tavilyResult(HUB_URL, { content: HUB_CONTENT, published_date: "2026-10-21", score: 0.9 }),
  tavilyResult(HUB_WIRE_URL, { content: "Northwind opened its Rotterdam hub.", published_date: "2026-10-22" }),
];
const hubClaims = { "Northwind Freight": [{ text: "Opened a cold-chain hub in Rotterdam.", quote: HUB_QUOTE, urls: [HUB_URL, HUB_WIRE_URL] }] };

function post(input: BriefingInput): Request {
  return new Request("http://localhost/api/briefing", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(input),
  });
}

function dependencies(environmentSource: Record<string, string> = TEST_ENVIRONMENT_SOURCE): BriefingRequestDependencies {
  const runBriefing: BriefingRequestDependencies["createBriefing"] = (input, now, options) =>
    createBriefing(input, now, { ...options, environmentSource, pause: recordingPause().pause });
  return { limiter: createSubjectRateLimiter(), createBriefing: runBriefing, now: () => NOW };
}

async function linesOf(response: Response): Promise<StreamLine[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => streamLineSchema.parse(JSON.parse(line)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("handleBriefingRequest stream", () => {
  it("streams progress events in order as NDJSON and ends with the result", async () => {
    stubBriefingNetwork({ results: { "Northwind Freight": hubResults }, claims: hubClaims });
    const response = await handleBriefingRequest(post(meeting([northwind])), dependencies());
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson; charset=utf-8");
    const lines = await linesOf(response);
    expect(lines.map((line) => line.type)).toEqual(["searching", "sources", "extracted", "checking", "writing", "done", "result"]);
    const last = lines.at(-1);
    expect(last?.type === "result" ? last.briefing.claims[0]?.status : null).toBe("verified");
  });

  it("returns a result with a note when only one subject fails", async () => {
    stubBriefingNetwork({ results: { "Northwind Freight": hubResults }, claims: hubClaims });
    const fetchMock = vi.mocked(fetch);
    const answer = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) =>
      String(init?.body).includes("Jonas Weber") && String(input).includes("tavily")
        ? jsonResponse({}, 500)
        : ((await answer?.(input, init)) ?? jsonResponse({}, 500)),
    );
    const lines = await linesOf(await handleBriefingRequest(post(meeting([northwind, jonas])), dependencies()));
    const last = lines.at(-1);
    expect(last?.type).toBe("result");
    expect(last?.type === "result" ? last.briefing.subjects.map((section) => section.note?.kind ?? null) : []).toEqual([null, "research-failed"]);
  });

  it("ends with one generic error line when every subject fails upstream", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubNetwork({ tavily: () => jsonResponse({ detail: "upstream secret detail" }, 500) });
    const lines = await linesOf(await handleBriefingRequest(post(meeting([northwind, jonas])), dependencies()));
    expect(lines.at(-1)).toEqual({ type: "error", message: "We could not research any of these people or companies. Please try again in a minute." });
    expect(JSON.stringify(lines)).not.toMatch(/upstream secret detail|500|bifrost\.test|tavily/i);
  });

  it("logs the detail on the server but sends only a generic message when the pipeline throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lines = await linesOf(await handleBriefingRequest(post(meeting([northwind])), dependencies({})));
    expect(lines).toEqual([{ type: "error", message: "We could not prepare this briefing. Please try again in a minute." }]);
    expect(String(log.mock.calls[0]?.[0])).toContain("TAVILY_API_KEY is missing");
    expect(JSON.stringify(lines)).not.toContain("TAVILY");
  });

  it("aborts the pipeline when the client disconnects", async () => {
    let received: AbortSignal | undefined;
    const createBriefingSpy: BriefingRequestDependencies["createBriefing"] = (_input, _now, options) => {
      received = options?.signal;
      options?.onProgress?.({ type: "searching", subjectId: "c1", queryCount: 5 });
      return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("stopped"))));
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handleBriefingRequest(post(meeting([northwind])), { ...dependencies(), createBriefing: createBriefingSpy });
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    expect(received?.aborted).toBe(true);
  });
});
