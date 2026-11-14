import { afterEach, describe, expect, it, vi } from "vitest";
import { researchAll } from "@/lib/research/tavily";
import { jsonResponse, makeSubject, requestsSent, stubTavily, tavilyResult, TEST_ENVIRONMENT, TEST_WINDOW } from "@/tests/support/testDoubles";

const northwind = makeSubject("c1", "Northwind Freight", "company");
const amara = makeSubject("p1", "Amara Diallo", "person", { company: "Northwind Freight" });
const jonas = makeSubject("p2", "Jonas Weber", "person", { company: "Northwind Freight" });

const SHARED_URL = "https://news.example/northwind-appoints-finance-chief";


afterEach(() => {
  vi.unstubAllGlobals();
});

describe("researchAll for several subjects", () => {
  it("adds the shared company to both people's searches and merges their shared source", async () => {
    const fetchMock = stubTavily(() => jsonResponse({ results: [tavilyResult(SHARED_URL)] }));
    const { sources } = await researchAll([amara, jonas], TEST_WINDOW, TEST_ENVIRONMENT);
    const queries = requestsSent(fetchMock).map((request) => request.query);
    expect(queries).toHaveLength(6);
    expect(queries.every((query) => query.includes('"Northwind Freight"'))).toBe(true);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.subjectIds).toEqual(["p1", "p2"]);
  });

  it("stores a source found for a person and their company once, tagged with both", async () => {
    stubTavily((request) => {
      const own = `https://news.example/${encodeURIComponent(request.query)}`;
      return jsonResponse({ results: [tavilyResult(own), tavilyResult(SHARED_URL, { score: 0.9 })] });
    });
    const { sources } = await researchAll([northwind, amara], TEST_WINDOW, TEST_ENVIRONMENT);
    const shared = sources.filter((source) => source.url === SHARED_URL);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.subjectIds).toEqual(["c1", "p1"]);
    expect(new Set(sources.map((source) => source.id)).size).toBe(sources.length);
  });

  it("gives five subjects two searches each with at most 6 requests in flight", async () => {
    let active = 0;
    let highest = 0;
    const fetchMock = stubTavily(async (request) => {
      active += 1;
      highest = Math.max(highest, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return jsonResponse({ results: [tavilyResult(`https://news.example/${encodeURIComponent(request.query)}`)] });
    });
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    const subjects = names.map((name, index) => makeSubject(`c${index}`, `${name} Example`, "company"));
    const { sources } = await researchAll(subjects, TEST_WINDOW, TEST_ENVIRONMENT);
    const queries = requestsSent(fetchMock).map((request) => request.query);
    for (const name of names) {
      expect(queries.filter((query) => query.startsWith(`"${name} Example"`))).toHaveLength(2);
    }
    expect(highest).toBeLessThanOrEqual(6);
    expect(sources).toHaveLength(10);
  });

  it("keeps 40 sources in total and MAX_SOURCES_PER_SUBJECT (8) per subject at most", async () => {
    stubTavily((request) =>
      jsonResponse({
        results: Array.from({ length: 8 }, (_, index) =>
          tavilyResult(`https://news.example/${encodeURIComponent(request.query)}/${index}`),
        ),
      }),
    );
    const subjects = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map((name, index) =>
      makeSubject(`c${index}`, `${name} Example`, "company"),
    );
    const { sources } = await researchAll(subjects, TEST_WINDOW, TEST_ENVIRONMENT);
    expect(sources).toHaveLength(40);
    for (const subject of subjects) {
      const count = sources.filter((source) => source.subjectIds.includes(subject.id)).length;
      expect(count).toBeLessThanOrEqual(TEST_ENVIRONMENT.MAX_SOURCES_PER_SUBJECT);
    }
  });

  it("reports a subject whose searches all failed and keeps the others", async () => {
    stubTavily((request) =>
      request.query.startsWith('"Jonas Weber"')
        ? jsonResponse({}, 503)
        : jsonResponse({ results: [tavilyResult(`https://news.example/${encodeURIComponent(request.query)}`)] }),
    );
    const { sources, failedSubjectIds } = await researchAll([northwind, amara, jonas], TEST_WINDOW, TEST_ENVIRONMENT);
    expect(failedSubjectIds).toEqual(["p2"]);
    expect(sources.some((source) => source.subjectIds.includes("c1"))).toBe(true);
    expect(sources.some((source) => source.subjectIds.includes("p1"))).toBe(true);
    expect(sources.some((source) => source.subjectIds.includes("p2"))).toBe(false);
  });
});
