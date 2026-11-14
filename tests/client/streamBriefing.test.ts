import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamBriefing } from "@/lib/client/streamBriefing";
import { meeting } from "@/tests/support/briefingScenario";
import { jsonResponse, makeSubject } from "@/tests/support/testDoubles";
import type { BriefingResult, StreamLine } from "@/lib/types";

const input = meeting([makeSubject("c1", "Northwind Freight", "company")]);

const emptyBriefing: BriefingResult = {
  input,
  window: { startDate: "2026-10-12", lastDate: "2026-11-11", endDate: "2026-11-12" },
  generatedAt: "2026-11-11T08:00:00.000Z",
  subjects: [],
  groups: [],
  claims: [],
  sharedClaimIds: [],
  snapshot: "Nothing significant between 12 Oct and 11 Nov.",
  questions: [],
  openQuestions: [],
  sources: [],
  research: { searchesRun: 5, sourcesFound: 0 },
  counts: { verified: 0, singleSource: 0, unconfirmed: 0 },
  modelCalls: [],
};

// Splits the encoded stream at awkward points, including inside a multi-byte character.
function ndjsonResponse(lines: string[], chunkSize = 7): Response {
  const bytes = new TextEncoder().encode(lines.join("\n") + "\n");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamBriefing", () => {
  it("posts the input, validates each line, skips bad ones and returns the result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      ndjsonResponse([
        JSON.stringify({ type: "searching", subjectId: "c1", queryCount: 5 }),
        "not json",
        JSON.stringify({ type: "checking", subjectIds: ["c1"], checked: 1, total: 1, claim: { text: "Ouvert à Rotterdam.", status: "verified" }, checks: { quoteSourceId: "S1", quoteDomain: "news.example", publishedDate: "2026-10-21", secondSourceId: null } }),
        JSON.stringify({ type: "unknown-event" }),
        JSON.stringify({ type: "result", briefing: emptyBriefing }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const events: StreamLine[] = [];
    const outcome = await streamBriefing(input, (event) => events.push(event));
    expect(fetchMock).toHaveBeenCalledWith("/api/briefing", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    expect(events.map((event) => event.type)).toEqual(["searching", "checking", "result"]);
    expect(events[1]?.type === "checking" ? events[1].claim.text : "").toBe("Ouvert à Rotterdam.");
    expect(outcome).toEqual({ kind: "result", briefing: emptyBriefing });
  });

  it("returns the server's error line as the outcome", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => ndjsonResponse([JSON.stringify({ type: "error", message: "Try again." })])));
    expect(await streamBriefing(input, () => undefined)).toEqual({ kind: "error", message: "Try again." });
  });

  it("reports a stream that ends without a result as a lost connection", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => ndjsonResponse([JSON.stringify({ type: "done" })])));
    expect((await streamBriefing(input, () => undefined)).kind).toBe("error");
  });

  it("returns field problems for a 400 and the wait for a 429", async () => {
    const fields = [{ path: "subjects.0.name", message: "This field is required." }];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({ error: "Some fields need attention.", fields }, 400)));
    expect(await streamBriefing(input, () => undefined)).toEqual({
      kind: "rejected",
      status: 400,
      message: "Some fields need attention.",
      fields,
      retryAfterSeconds: null,
    });
    const limited = new Response(JSON.stringify({ error: "Too many briefings." }), { status: 429, headers: { "Retry-After": "420" } });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => limited));
    expect(await streamBriefing(input, () => undefined)).toMatchObject({ kind: "rejected", status: 429, retryAfterSeconds: 420 });
  });

  it("imports nothing but the shared schemas", () => {
    const source = readFileSync(path.join(process.cwd(), "lib", "client", "streamBriefing.ts"), "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual(["@/lib/types"]);
  });
});
