// What the evidence panel says about one claim. Every line comes from the verification result;
// nothing here is generic reassurance.
import { findQuoteSpan } from "@/lib/shared/quoteMatch";
import type { Source, VerifiedClaim } from "@/lib/types";
import { formatDayMonth } from "./dates";

const EXCERPT_LENGTH = 300;
const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five"];

// Only the checks this claim actually passed.
export function passedChecks(claim: VerifiedClaim): string[] {
  if (claim.status === "unconfirmed") {
    return [];
  }
  const quoteSource = claim.sources.find((source) => source.id === claim.quoteSourceId);
  const checks: string[] = [];
  if (quoteSource !== undefined) {
    checks.push(`The supporting sentence was found word for word in ${quoteSource.id}, ${quoteSource.domain}.`);
  }
  const dated = quoteSource?.publishedDate ?? claim.sources.find((source) => source.publishedDate !== null)?.publishedDate ?? null;
  if (dated !== null) {
    checks.push(`Published ${formatDayMonth(dated)}, inside the 30 days we read.`);
  }
  const domains = new Set(claim.sources.map((source) => source.domain)).size;
  if (claim.status === "verified") {
    checks.push(`${NUMBER_WORDS[domains] ?? domains} independent sites report it.`);
  }
  return checks;
}

// For an unconfirmed claim: the check that failed, in words.
export function failedCheck(claim: VerifiedClaim): string | null {
  if (claim.status !== "unconfirmed") {
    return null;
  }
  if (claim.quoteSourceId === null) {
    return "We could not find the quoted sentence in the cited source, so this is left out of the summary.";
  }
  return "None of the cited sources has a publish date, so we could not place this inside the 30 days.";
}

export type Excerpt = { before: string; match: string; after: string };

function trimToWords(text: string, start: number, end: number): { start: number; end: number } {
  const nextSpace = start > 0 ? text.indexOf(" ", start) : -1;
  const previousSpace = end < text.length ? text.lastIndexOf(" ", end) : -1;
  return { start: nextSpace === -1 ? start : nextSpace + 1, end: previousSpace === -1 ? end : previousSpace };
}

// The source text around the quote, about 300 characters, with the quote found by the same
// match verification uses. Plain text only; source HTML is never rendered.
export function sourceExcerpt(source: Source, quote: string): Excerpt {
  const span = findQuoteSpan(source.content, quote);
  if (span === null) {
    const cut = source.content.length > EXCERPT_LENGTH;
    return { before: source.content.slice(0, EXCERPT_LENGTH) + (cut ? "…" : ""), match: "", after: "" };
  }
  const room = Math.max(0, EXCERPT_LENGTH - (span.end - span.start));
  const rawStart = Math.max(0, span.start - Math.floor(room / 2));
  const rawEnd = Math.min(span.text.length, span.end + room - (span.start - rawStart));
  const bounds = trimToWords(span.text, Math.min(rawStart, span.start), Math.max(rawEnd, span.end));
  const start = Math.min(bounds.start, span.start);
  const end = Math.max(bounds.end, span.end);
  return {
    before: (start > 0 ? "…" : "") + span.text.slice(start, span.start),
    match: span.text.slice(span.start, span.end),
    after: span.text.slice(span.end, end) + (end < span.text.length ? "…" : ""),
  };
}

export function citationText(claim: VerifiedClaim): string {
  const sources = claim.sources.map((source) => `${source.id}. ${source.title}. ${source.url}`);
  return [claim.text, "", "Sources:", ...sources].join("\n");
}
