// Assigns each claim its status by checking source ids and quotes in code. No model call here:
// whatever a source or the model says about a claim's status is never read.
import { findQuoteSpan, normaliseForMatching } from "@/lib/shared/quoteMatch";
import type { Claim, ClaimStatus, Source, VerifiedClaim } from "@/lib/types";

const STATUS_ORDER: Record<ClaimStatus, number> = { verified: 0, "single-source": 1, unconfirmed: 2 };

type CheckedClaim = Omit<VerifiedClaim, "id">;

// Unknown ids are dropped. A cited source that shares no subject with the claim means the model
// cited outside what it was shown, so the whole claim is rejected.
function citedSources(claim: Claim, sourceById: ReadonlyMap<string, Source>): Source[] | null {
  const cited = [...new Set(claim.sourceIds)].flatMap((id) => {
    const source = sourceById.get(id);
    return source === undefined ? [] : [source];
  });
  const crossesSubjects = cited.some((source) => !source.subjectIds.some((id) => claim.subjectIds.includes(id)));
  return cited.length === 0 || crossesSubjects ? null : cited;
}

// The first cited source whose text contains the quote, by the shared whole-word match.
function findQuoteSource(quote: string, sources: readonly Source[]): string | null {
  return sources.find((source) => findQuoteSpan(source.content, quote) !== null)?.id ?? null;
}

function statusFor(quoteSourceId: string | null, sources: readonly Source[]): ClaimStatus {
  if (quoteSourceId === null || sources.every((source) => source.publishedDate === null)) {
    return "unconfirmed";
  }
  return new Set(sources.map((source) => source.domain)).size >= 2 ? "verified" : "single-source";
}

function checkClaim(claim: Claim, sourceById: ReadonlyMap<string, Source>): CheckedClaim | null {
  const sources = citedSources(claim, sourceById);
  if (sources === null) {
    return null;
  }
  const quoteSourceId = findQuoteSource(claim.quote, sources);
  return {
    ...claim,
    sourceIds: sources.map((source) => source.id),
    sources,
    quoteSourceId,
    status: statusFor(quoteSourceId, sources),
  };
}

function mergeInto(kept: CheckedClaim, duplicate: CheckedClaim): CheckedClaim {
  const sources = [...kept.sources, ...duplicate.sources.filter((source) => !kept.sourceIds.includes(source.id))];
  return {
    ...kept,
    date: kept.date ?? duplicate.date,
    subjectIds: [...new Set([...kept.subjectIds, ...duplicate.subjectIds])],
    sourceIds: sources.map((source) => source.id),
    sources,
    status: statusFor(kept.quoteSourceId, sources),
  };
}

// The same quote found in the same source under two subjects is one claim tagged with both.
function mergeSharedClaims(claims: readonly CheckedClaim[]): CheckedClaim[] {
  const merged = new Map<string, CheckedClaim>();
  claims.forEach((claim, index) => {
    const key =
      claim.quoteSourceId === null ? `unmatched:${index}` : `${claim.quoteSourceId}:${normaliseForMatching(claim.quote)}`;
    const existing = merged.get(key);
    merged.set(key, existing === undefined ? claim : mergeInto(existing, claim));
  });
  return [...merged.values()];
}

// The claim's own date when it has one, otherwise its newest cited source.
function sortDate(claim: CheckedClaim): string {
  const sourceDates = claim.sources.flatMap((source) => (source.publishedDate === null ? [] : [source.publishedDate]));
  return claim.date ?? sourceDates.sort().at(-1) ?? "";
}

function compareClaims(first: CheckedClaim, second: CheckedClaim): number {
  const byStatus = STATUS_ORDER[first.status] - STATUS_ORDER[second.status];
  return byStatus !== 0 ? byStatus : sortDate(second).localeCompare(sortDate(first));
}

export function verifyClaims(claims: readonly Claim[], sources: readonly Source[]): VerifiedClaim[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const checked = claims.flatMap((claim) => {
    const result = checkClaim(claim, sourceById);
    return result === null ? [] : [result];
  });
  return mergeSharedClaims(checked)
    .sort(compareClaims)
    .map((claim, index) => ({ id: `C${index + 1}`, ...claim }));
}
