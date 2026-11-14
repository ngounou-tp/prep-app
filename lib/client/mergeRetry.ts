// "Try this one again" reruns one subject. Its result arrives with its own S1.. and C1.. ids,
// so they are renumbered after the current ones and only that subject's section changes.
import { MAX_QUESTIONS, type BriefingResult, type Source, type StatusCounts, type VerifiedClaim } from "@/lib/types";

const PAGE_LIMIT = 8;

function highestNumber(ids: readonly string[]): number {
  return ids.reduce((highest, id) => Math.max(highest, Number(id.slice(1)) || 0), 0);
}

// A source already in the briefing (same URL) keeps its id; new ones are numbered after the rest.
function mergeSources(current: readonly Source[], incoming: readonly Source[]): { sources: Source[]; renamed: Map<string, string> } {
  const byUrl = new Map(current.map((source) => [source.url, { ...source }]));
  const renamed = new Map<string, string>();
  let next = highestNumber(current.map((source) => source.id));
  for (const source of incoming) {
    const existing = byUrl.get(source.url);
    if (existing !== undefined) {
      existing.subjectIds = [...new Set([...existing.subjectIds, ...source.subjectIds])];
      renamed.set(source.id, existing.id);
    } else {
      next += 1;
      renamed.set(source.id, `S${next}`);
      byUrl.set(source.url, { ...source, id: `S${next}` });
    }
  }
  const sources = [...byUrl.values()].sort((first, second) => Number(first.id.slice(1)) - Number(second.id.slice(1)));
  return { sources, renamed };
}

function renameClaims(claims: readonly VerifiedClaim[], firstNumber: number, sourceIds: ReadonlyMap<string, string>, sources: readonly Source[]) {
  const renamed = new Map<string, string>();
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const result = claims.map((claim, index): VerifiedClaim => {
    const id = `C${firstNumber + index}`;
    renamed.set(claim.id, id);
    const ids = claim.sourceIds.map((sourceId) => sourceIds.get(sourceId) ?? sourceId);
    const quoteSourceId = claim.quoteSourceId === null ? null : (sourceIds.get(claim.quoteSourceId) ?? claim.quoteSourceId);
    return { ...claim, id, sourceIds: ids, quoteSourceId, sources: ids.flatMap((sourceId) => sourceById.get(sourceId) ?? []) };
  });
  return { claims: result, renamed };
}

function countStatuses(claims: readonly VerifiedClaim[]): StatusCounts {
  return {
    verified: claims.filter((claim) => claim.status === "verified").length,
    singleSource: claims.filter((claim) => claim.status === "single-source").length,
    unconfirmed: claims.filter((claim) => claim.status === "unconfirmed").length,
  };
}

export function mergeRetry(current: BriefingResult, retry: BriefingResult, subjectId: string): BriefingResult {
  const { sources, renamed: sourceIds } = mergeSources(current.sources, retry.sources);
  // Claims only about this subject came from the failed attempt; shared claims stay.
  const kept = current.claims.filter((claim) => !(claim.subjectIds.length === 1 && claim.subjectIds[0] === subjectId));
  const { claims: added, renamed: claimIds } = renameClaims(retry.claims, highestNumber(current.claims.map((claim) => claim.id)) + 1, sourceIds, sources);
  const retrySection = retry.subjects.find((section) => section.subjectId === subjectId);
  const othersShown = current.subjects.filter((section) => section.subjectId !== subjectId).reduce((total, section) => total + section.shownClaimIds.length, 0);
  const shownIds = (retrySection?.shownClaimIds ?? []).map((id) => claimIds.get(id) ?? id);
  const allowed = shownIds.slice(0, Math.max(1, PAGE_LIMIT - othersShown));
  const claims = [...kept, ...added];
  const subjects = current.subjects.map((section) =>
    section.subjectId !== subjectId || retrySection === undefined
      ? section
      : { ...retrySection, shownClaimIds: allowed, moreCount: retrySection.moreCount + shownIds.length - allowed.length },
  );
  const retryQuestions = retry.questions.map((question) => ({ ...question, claimId: claimIds.get(question.claimId) ?? question.claimId }));
  return {
    ...current,
    subjects,
    claims,
    sources,
    snapshot: current.snapshot ?? retry.snapshot,
    questions: [...current.questions, ...retryQuestions].slice(0, MAX_QUESTIONS),
    counts: countStatuses(claims),
    research: {
      searchesRun: current.research.searchesRun + retry.research.searchesRun,
      sourcesFound: current.research.sourcesFound + retry.research.sourcesFound,
    },
    modelCalls: [...current.modelCalls, ...retry.modelCalls],
  };
}
