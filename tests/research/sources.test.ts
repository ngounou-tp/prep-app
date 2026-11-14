import { describe, expect, it } from "vitest";
import { mergeSources } from "@/lib/research/sources";
import { TEST_WINDOW } from "@/tests/support/testDoubles";
import type { SearchHit } from "@/lib/types";

// The largest limits allowed; the configured defaults are tested at the end.
const LIMITS = { perSubject: 12, contentCharacters: 1500 };

function hit(url: string, overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    subjectId: "c1",
    title: "Example headline",
    url,
    content: "Example content.",
    score: 0.5,
    publishedDate: "2026-11-01",
    ...overrides,
  };
}

describe("mergeSources", () => {
  it("strips URL fragments and drops duplicate URLs", () => {
    const sources = mergeSources([hit("https://news.example/hub#top"), hit("https://news.example/hub")], TEST_WINDOW, LIMITS);
    expect(sources.map((source) => source.url)).toEqual(["https://news.example/hub"]);
  });

  it("drops dated results outside the window, with the end date exclusive", () => {
    const sources = mergeSources(
      [
        hit("https://news.example/before", { publishedDate: "2026-10-11" }),
        hit("https://news.example/first-day", { publishedDate: "2026-10-12" }),
        hit("https://news.example/last-day", { publishedDate: "2026-11-11T23:00:00Z" }),
        hit("https://news.example/after", { publishedDate: "2026-11-12" }),
      ],
      TEST_WINDOW,
      LIMITS,
    );
    expect(sources.map((source) => source.url)).toEqual(["https://news.example/first-day", "https://news.example/last-day"]);
  });

  it("keeps undated and unparseable dates as publishedDate null", () => {
    const sources = mergeSources(
      [hit("https://news.example/undated", { publishedDate: null }), hit("https://news.example/odd", { publishedDate: "soon" })],
      TEST_WINDOW,
      LIMITS,
    );
    expect(sources.map((source) => source.publishedDate)).toEqual([null, null]);
  });

  it("accepts only http and https URLs", () => {
    const sources = mergeSources(
      [hit("ftp://files.example/a"), hit("javascript:alert(1)"), hit("not a url"), hit("http://plain.example/a")],
      TEST_WINDOW,
      LIMITS,
    );
    expect(sources.map((source) => source.url)).toEqual(["http://plain.example/a"]);
  });

  it("trims content to 1500 characters and reads the domain without www", () => {
    const [source] = mergeSources([hit("https://www.news.example/a", { content: `  ${"word ".repeat(600)}` })], TEST_WINDOW, LIMITS);
    expect(source?.content).toHaveLength(1500);
    expect(source?.domain).toBe("news.example");
  });

  it("sorts by score and numbers the sources S1 to Sn", () => {
    const sources = mergeSources(
      [hit("https://news.example/low", { score: 0.2 }), hit("https://news.example/high", { score: 0.9 })],
      TEST_WINDOW,
      LIMITS,
    );
    expect(sources.map((source) => [source.id, source.url])).toEqual([
      ["S1", "https://news.example/high"],
      ["S2", "https://news.example/low"],
    ]);
  });

  it("stores a URL found for two subjects once, tagged with both", () => {
    const sources = mergeSources(
      [hit("https://news.example/shared", { subjectId: "c1", score: 0.4 }), hit("https://news.example/shared", { subjectId: "p1", score: 0.8 })],
      TEST_WINDOW,
      LIMITS,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ subjectIds: ["c1", "p1"], score: 0.8 });
  });

  it("keeps at most 12 sources per subject", () => {
    const hits = Array.from({ length: 15 }, (_, index) => hit(`https://news.example/${index}`));
    expect(mergeSources(hits, TEST_WINDOW, LIMITS)).toHaveLength(12);
  });

  it("keeps at most 40 sources in total", () => {
    const hits = Array.from({ length: 60 }, (_, index) => hit(`https://news.example/${index}`, { subjectId: `s${index % 5}` }));
    const sources = mergeSources(hits, TEST_WINDOW, LIMITS);
    expect(sources).toHaveLength(40);
    expect(sources.at(-1)?.id).toBe("S40");
  });

  it("applies the configured per-subject and content limits", () => {
    const hits = Array.from({ length: 10 }, (_, index) => hit(`https://news.example/${index}`, { content: "x".repeat(1000) }));
    const sources = mergeSources(hits, TEST_WINDOW, { perSubject: 8, contentCharacters: 800 });
    expect(sources).toHaveLength(8);
    expect(sources.every((source) => source.content.length === 800)).toBe(true);
  });
});
