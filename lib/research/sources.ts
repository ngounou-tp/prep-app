import type { ResearchWindow, SearchHit, Source } from "@/lib/types";
import { toUtcDateString } from "@/lib/research/window";

const MAX_SOURCES_TOTAL = 40;

type Candidate = Omit<Source, "id">;

// From MAX_SOURCES_PER_SUBJECT and SOURCE_CHARS: how much research each subject keeps.
type SourceLimits = { perSubject: number; contentCharacters: number };

// Only http and https survive, and the fragment is dropped so #section links dedupe.
function normaliseUrl(raw: string): URL | null {
  if (!URL.canParse(raw)) {
    return null;
  }
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  url.hash = "";
  return url;
}

// Tavily's date format is not documented, so anything unparseable counts as undated.
function toPublishedDate(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : toUtcDateString(date);
}

function isInsideWindow(date: string, window: ResearchWindow): boolean {
  return date >= window.startDate && date < window.endDate;
}

function toCandidate(hit: SearchHit, window: ResearchWindow, contentCharacters: number): Candidate | null {
  const url = normaliseUrl(hit.url);
  if (url === null) {
    return null;
  }
  const publishedDate = toPublishedDate(hit.publishedDate);
  if (publishedDate !== null && !isInsideWindow(publishedDate, window)) {
    return null;
  }
  const domain = url.hostname.replace(/^www\./, "");
  return {
    title: hit.title.trim() || domain,
    url: url.href,
    domain,
    content: hit.content.replace(/\s+/g, " ").trim().slice(0, contentCharacters),
    publishedDate,
    score: hit.score,
    subjectIds: [hit.subjectId],
  };
}

function combine(kept: Candidate, duplicate: Candidate): Candidate {
  return {
    ...kept,
    publishedDate: kept.publishedDate ?? duplicate.publishedDate,
    score: Math.max(kept.score, duplicate.score),
    subjectIds: [...new Set([...kept.subjectIds, ...duplicate.subjectIds])],
  };
}

// A shared source counts toward every subject it is tagged with, so no subject exceeds its cap.
function applyCaps(ranked: Candidate[], perSubject: number): Candidate[] {
  const countBySubject = new Map<string, number>();
  const kept: Candidate[] = [];
  for (const candidate of ranked) {
    if (kept.length >= MAX_SOURCES_TOTAL) {
      break;
    }
    const subjectIsFull = candidate.subjectIds.some(
      (subjectId) => (countBySubject.get(subjectId) ?? 0) >= perSubject,
    );
    if (subjectIsFull) {
      continue;
    }
    kept.push(candidate);
    for (const subjectId of candidate.subjectIds) {
      countBySubject.set(subjectId, (countBySubject.get(subjectId) ?? 0) + 1);
    }
  }
  return kept;
}

export function mergeSources(hits: readonly SearchHit[], window: ResearchWindow, limits: SourceLimits): Source[] {
  const byUrl = new Map<string, Candidate>();
  for (const hit of hits) {
    const candidate = toCandidate(hit, window, limits.contentCharacters);
    if (candidate === null) {
      continue;
    }
    const existing = byUrl.get(candidate.url);
    byUrl.set(candidate.url, existing === undefined ? candidate : combine(existing, candidate));
  }
  const ranked = [...byUrl.values()].sort((first, second) => second.score - first.score);
  return applyCaps(ranked, limits.perSubject).map((candidate, index) => ({ id: `S${index + 1}`, ...candidate }));
}
