import { afterEach, describe, expect, it, vi } from "vitest";
import { researchAll, search, TavilyError } from "@/lib/research/tavily";
import { jsonResponse, makeSubject, requestsSent, stubTavily, tavilyResult, TEST_ENVIRONMENT, TEST_WINDOW } from "@/tests/support/testDoubles";

const NEWS_QUERY = { text: '"Northwind Freight" latest news', topic: "news" } as const;
const company = makeSubject("c1", "Northwind Freight", "company");

// Each query gets its own URL so results only collide when a test wants them to.
function uniqueResultPerQuery(request: { query: string }) {
  return jsonResponse({ results: [tavilyResult(`https://news.example/${encodeURIComponent(request.query)}`)] });
}


afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("search", () => {
  it("posts the documented body with a bearer key", async () => {
    const fetchMock = stubTavily(() => jsonResponse({ results: [] }));
    await search(NEWS_QUERY, TEST_WINDOW, true, "test-key-not-real");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.tavily.com/search");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key-not-real" });
    expect(requestsSent(fetchMock)[0]).toEqual({
      query: '"Northwind Freight" latest news',
      topic: "news",
      search_depth: "basic",
      max_results: 8,
      start_date: "2026-10-12",
      end_date: "2026-11-12",
      include_published_date: true,
      exact_match: true,
    });
  });

  it("throws a typed error on a non-200 response", async () => {
    stubTavily(() => jsonResponse({ detail: "limit" }, 429));
    await expect(search(NEWS_QUERY, TEST_WINDOW, true, "key")).rejects.toMatchObject({ kind: "http", status: 429 });
  });

  it("aborts after 12 seconds with a timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );
    const pending = search(NEWS_QUERY, TEST_WINDOW, true, "key");
    const assertions = Promise.all([
      expect(pending).rejects.toBeInstanceOf(TavilyError),
      expect(pending).rejects.toMatchObject({ kind: "timeout" }),
    ]);
    await vi.advanceTimersByTimeAsync(12_000);
    await assertions;
  });

  it("ignores malformed items and keeps the valid ones", async () => {
    stubTavily(() => jsonResponse({ results: [tavilyResult("https://news.example/ok"), { url: 5 }, { title: "no url" }] }));
    const results = await search(NEWS_QUERY, TEST_WINDOW, true, "key");
    expect(results.map((result) => result.url)).toEqual(["https://news.example/ok"]);
  });

  it("rejects a response without a results array", async () => {
    stubTavily(() => jsonResponse({ error: "unexpected" }));
    await expect(search(NEWS_QUERY, TEST_WINDOW, true, "key")).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("researchAll for one subject", () => {
  it("cleans results: dedupes, drops out-of-window and non-http, keeps undated", async () => {
    stubTavily(() =>
      jsonResponse({
        results: [
          tavilyResult("https://news.example/hub#section", { score: 0.9 }),
          tavilyResult("https://news.example/hub", { score: 0.7 }),
          tavilyResult("https://news.example/old", { published_date: "2026-09-01" }),
          tavilyResult("https://news.example/undated", { published_date: null, score: 0.3 }),
          tavilyResult("ftp://files.example/report"),
        ],
      }),
    );
    const { sources, failedSubjectIds } = await researchAll([company], TEST_WINDOW, TEST_ENVIRONMENT);
    expect(sources.map((source) => [source.id, source.url, source.publishedDate])).toEqual([
      ["S1", "https://news.example/hub", "2026-11-01"],
      ["S2", "https://news.example/undated", null],
    ]);
    expect(failedSubjectIds).toEqual([]);
  });

  it("tolerates one failed search", async () => {
    stubTavily((request) => (request.query.includes("leadership") ? jsonResponse({}, 500) : uniqueResultPerQuery(request)));
    const { sources, failedSubjectIds } = await researchAll([company], TEST_WINDOW, TEST_ENVIRONMENT);
    expect(sources).toHaveLength(4);
    expect(failedSubjectIds).toEqual([]);
  });

  it("retries a query once without exact_match when it finds nothing", async () => {
    const fetchMock = stubTavily((request) =>
      request.query.includes("latest news") && request.exact_match ? jsonResponse({ results: [] }) : uniqueResultPerQuery(request),
    );
    const { sources, searchesRun } = await researchAll([company], TEST_WINDOW, TEST_ENVIRONMENT);
    expect(searchesRun).toBe(6);
    const newsRequests = requestsSent(fetchMock).filter((request) => request.query.includes("latest news"));
    expect(newsRequests.map((request) => request.exact_match)).toEqual([true, false]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(sources).toHaveLength(5);
  });

  it("never runs more than 12 searches, retries included", async () => {
    const fetchMock = stubTavily(() => jsonResponse({ results: [] }));
    const subjects = ["Alpha", "Bravo", "Charlie"].map((name, index) => makeSubject(`c${index}`, `${name} Example`, "company"));
    await researchAll(subjects, TEST_WINDOW, TEST_ENVIRONMENT);
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});
