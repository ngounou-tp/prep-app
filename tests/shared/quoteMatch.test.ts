import { describe, expect, it } from "vitest";
import { findQuoteSpan } from "@/lib/shared/quoteMatch";

describe("findQuoteSpan", () => {
  it("returns the span of the original text across case and punctuation differences", () => {
    const content = "Northwind Freight said on Tuesday that it has opened a Cold-Chain hub in Rotterdam, its first.";
    const span = findQuoteSpan(content, "IT HAS OPENED a cold chain hub, in Rotterdam");
    expect(span === null ? null : span.text.slice(span.start, span.end)).toBe("it has opened a Cold-Chain hub in Rotterdam");
  });

  it("matches whole words only", () => {
    expect(findQuoteSpan("The hubs opened in Rotterdamshire this week", "hubs opened in Rotterdam")).toBeNull();
  });

  it("handles decomposed accents and reports positions in the composed text", () => {
    const content = "Hier, la Société Générale a annoncé l'ouverture d'un entrepôt.".normalize("NFD");
    const span = findQuoteSpan(content, "société générale a annoncé l'ouverture");
    expect(span === null ? null : span.text.slice(span.start, span.end)).toBe("Société Générale a annoncé l'ouverture");
  });

  it("refuses quotes shorter than 20 characters after normalising", () => {
    expect(findQuoteSpan("opened a hub in Rotterdam", "opened a hub")).toBeNull();
  });
});
