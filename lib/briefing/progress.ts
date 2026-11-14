// Builds the progress events createBriefing emits. They carry counts, dates, ids, domains and
// claim text only: never source content, URLs, keys or upstream details.
import type { PlannedSearch } from "@/lib/research/queries";
import type { ProgressEvent, Source, Subject, VerifiedClaim } from "@/lib/types";

export function searchingEvents(subjects: readonly Subject[], planned: readonly PlannedSearch[]): ProgressEvent[] {
  return subjects.map((subject) => ({
    type: "searching",
    subjectId: subject.id,
    queryCount: planned.filter((search) => search.subjectId === subject.id).length,
  }));
}

export function sourcesEvents(subjects: readonly Subject[], sources: readonly Source[]): ProgressEvent[] {
  return subjects.map((subject) => {
    const own = sources.filter((source) => source.subjectIds.includes(subject.id));
    return {
      type: "sources",
      subjectId: subject.id,
      count: own.length,
      sourceIds: own.map((source) => source.id),
      publishedDates: own.map((source) => source.publishedDate),
    };
  });
}

// Only the checks this claim actually passed, taken from the verification result.
function passedChecks(claim: VerifiedClaim) {
  const quoteSource = claim.sources.find((source) => source.id === claim.quoteSourceId) ?? null;
  const secondSite = quoteSource === null ? null : (claim.sources.find((source) => source.domain !== quoteSource.domain) ?? null);
  return {
    quoteSourceId: quoteSource?.id ?? null,
    quoteDomain: quoteSource?.domain ?? null,
    publishedDate: quoteSource?.publishedDate ?? claim.sources.find((source) => source.publishedDate !== null)?.publishedDate ?? null,
    secondSourceId: secondSite?.id ?? null,
  };
}

export function checkingEvents(claims: readonly VerifiedClaim[]): ProgressEvent[] {
  return claims.map((claim, index) => ({
    type: "checking",
    subjectIds: claim.subjectIds,
    checked: index + 1,
    total: claims.length,
    claim: { text: claim.text, status: claim.status },
    checks: passedChecks(claim),
  }));
}
