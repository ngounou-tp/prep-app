import { describe, expect, it } from "vitest";
import { citationText, failedCheck, passedChecks, sourceExcerpt } from "@/lib/client/evidence";
import { fixtureClaim, fixtureSource } from "@/tests/support/briefingFixture";

describe("evidence", () => {
  it("lists only the checks a verified claim passed", () => {
    const sources = [fixtureSource("S4", ["c1"]), fixtureSource("S11", ["c1"], { domain: "wire.example" })];
    const checks = passedChecks(fixtureClaim("C1", ["c1"], { sources }));
    expect(checks).toHaveLength(3);
    expect(checks[0]).toBe("The supporting sentence was found word for word in S4, news.example.");
    expect(checks[2]).toBe("Two independent sites report it.");
  });

  it("does not claim a second site for a single-source claim", () => {
    const checks = passedChecks(fixtureClaim("C1", ["c1"], { status: "single-source" }));
    expect(checks.some((check) => check.includes("independent sites"))).toBe(false);
  });

  it("states the failed check for an unconfirmed claim and lists no passed checks", () => {
    const claim = fixtureClaim("C1", ["c1"], { status: "unconfirmed" });
    expect(passedChecks(claim)).toEqual([]);
    expect(failedCheck(claim)).toContain("could not find the quoted sentence");
  });

  it("highlights exactly the verified quote inside about 300 characters of source text", () => {
    const content = `${"Earlier news. ".repeat(40)}Northwind Freight said that it has opened a Cold-Chain hub in Rotterdam, its first site. ${"More text. ".repeat(40)}`;
    const excerpt = sourceExcerpt(fixtureSource("S1", ["c1"], { content }), "it has opened a cold chain hub in Rotterdam");
    expect(excerpt.match).toBe("it has opened a Cold-Chain hub in Rotterdam");
    expect(excerpt.before.startsWith("…")).toBe(true);
    expect(excerpt.after.endsWith("…")).toBe(true);
    expect((excerpt.before + excerpt.match + excerpt.after).length).toBeLessThanOrEqual(310);
  });

  it("builds a plain-text citation with titles and URLs", () => {
    const text = citationText(fixtureClaim("C1", ["c1"]));
    expect(text).toBe("Development C1.\n\nSources:\nS1. Headline S1. https://news.example/s1");
  });
});
