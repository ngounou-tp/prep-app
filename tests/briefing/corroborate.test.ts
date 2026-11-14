import { describe, expect, it } from "vitest";
import { factWords, mergeCorroborated, sameFact } from "@/lib/briefing/corroborate";

// Invented company and people only.
function fact(text: string, date: string | null = "2026-11-12", quoteSourceId: string | null = "S1") {
  return { text, date, quoteSourceId };
}

describe("factWords", () => {
  it("keeps the words that carry the fact, with job titles shortened the same way", () => {
    expect([...factWords("Amara Diallo resigned as chief executive officer of Northwind’s board.")]).toEqual([
      "amara", "diallo", "resigned", "ceo", "northwind", "board",
    ]);
  });
});

describe("sameFact", () => {
  it("recognises one fact worded differently by two sites", () => {
    const first = fact("Amara Diallo resigned as president, chief executive officer and board member, effective immediately.");
    const second = fact("Amara Diallo resigned as CEO, President, and board member of Northwind effective immediately.", "2026-11-12", "S6");
    expect(sameFact(first, second)).toBe(true);
    expect(sameFact(fact("Northwind will report its third-quarter results on November 17, 2026."), fact("Northwind will report third-quarter results on November 17."))).toBe(true);
  });

  it("keeps facts apart when the date, a number or a negation differs", () => {
    const resigned = fact("Amara Diallo resigned as chief executive officer of Northwind Freight.");
    expect(sameFact(resigned, fact("Amara Diallo resigned as chief executive officer of Northwind Freight.", "2026-11-13"))).toBe(false);
    expect(sameFact(resigned, fact("Amara Diallo did not resign as chief executive officer of Northwind Freight."))).toBe(false);
    expect(sameFact(fact("Northwind Freight raised 40 million in new funding."), fact("Northwind Freight raised 50 million in new funding."))).toBe(false);
  });

  it("never merges a claim whose quote was not found, an undated claim, or a very short one", () => {
    const text = "Amara Diallo resigned as chief executive officer of Northwind Freight.";
    expect(sameFact(fact(text), fact(text, "2026-11-12", null))).toBe(false);
    expect(sameFact(fact(text, null), fact(text, null))).toBe(false);
    expect(sameFact(fact("Shares rose."), fact("Shares rose."))).toBe(false);
  });

  it("does not merge claims that share a few names but say different things", () => {
    const appointed = fact("Jonas Weber, Northwind's chief financial officer, was appointed interim chief executive officer.");
    const agreed = fact("Jonas Weber agreed to serve as interim CEO while keeping his finance duties.");
    expect(sameFact(appointed, agreed)).toBe(false);
  });
});

describe("mergeCorroborated", () => {
  it("joins each claim to the first earlier one stating the same fact", () => {
    const claims = [
      fact("Amara Diallo resigned as chief executive officer of Northwind Freight."),
      fact("Northwind Freight opened a cold-chain hub in Rotterdam."),
      fact("Amara Diallo resigned as CEO of Northwind Freight.", "2026-11-12", "S2"),
    ];
    const merged = mergeCorroborated(claims, (kept, duplicate) => ({ ...kept, text: `${kept.text} + ${duplicate.quoteSourceId}` }));
    expect(merged.map((claim) => claim.text)).toEqual([
      "Amara Diallo resigned as chief executive officer of Northwind Freight. + S2",
      "Northwind Freight opened a cold-chain hub in Rotterdam.",
    ]);
  });
});
