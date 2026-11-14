import { format, parseISO } from "date-fns";
import { keepOpenQuestions, knownWords } from "@/lib/briefing/openQuestions";
import { groupSubjects, homeSubjectId, selectForPage } from "@/lib/briefing/pageBudget";
import type {
  BriefingInput,
  BriefingResult,
  ModelCall,
  ResearchResult,
  ResearchWindow,
  StatusCounts,
  Subject,
  SubjectNote,
  SubjectSection,
  VerifiedClaim,
  Written,
} from "@/lib/types";
import { toUtcDateString } from "@/lib/research/window";

export type SubjectExtraction = {
  subjectId: string;
  outcome: "ok" | "no-sources" | "rate-limit" | "invalid-output" | "unavailable" | "not-completed";
  modelCall: ModelCall | null;
};

// "Nothing found" is an honest answer, not a failure.
const FAILED_NOTE_KINDS: ReadonlySet<SubjectNote["kind"]> = new Set(["research-failed", "model-rate-limit", "model-failed", "not-completed"]);

// The request fails only when every subject failed; otherwise failures are notes in the result.
export function everySubjectFailed(briefing: BriefingResult): boolean {
  return briefing.subjects.every((section) => section.note !== null && FAILED_NOTE_KINDS.has(section.note.kind));
}

// skipped: nothing survived verification, so no writing call was made.
export type WritingResult = { skipped: boolean; written: Written | null; modelCall: ModelCall | null };

type BriefingParts = {
  input: BriefingInput;
  searchWindow: ResearchWindow;
  now: Date;
  research: ResearchResult;
  extractions: readonly SubjectExtraction[];
  claims: readonly VerifiedClaim[];
  writing: WritingResult;
};

function countStatuses(claims: readonly VerifiedClaim[]): StatusCounts {
  return {
    verified: claims.filter((claim) => claim.status === "verified").length,
    singleSource: claims.filter((claim) => claim.status === "single-source").length,
    unconfirmed: claims.filter((claim) => claim.status === "unconfirmed").length,
  };
}

function countSources(count: number): string {
  return `${count} ${count === 1 ? "source" : "sources"}`;
}

function noteFor(subjectId: string, parts: BriefingParts, hasFindings: boolean): SubjectNote | null {
  if (parts.research.failedSubjectIds.includes(subjectId)) {
    return { kind: "research-failed", message: "The search failed for this subject. Try it again." };
  }
  const outcome = parts.extractions.find((extraction) => extraction.subjectId === subjectId)?.outcome;
  const sourceCount = parts.research.sources.filter((source) => source.subjectIds.includes(subjectId)).length;
  if (parts.research.unfinishedSubjectIds.includes(subjectId)) {
    return { kind: "not-completed", message: "Not finished. The search did not complete before the time limit. Try this subject again." };
  }
  if (outcome === "not-completed") {
    const message = `Not finished. We found ${countSources(sourceCount)} but could not check them before the time limit. Nothing about this subject is shown until it is checked.`;
    return { kind: "not-completed", message };
  }
  if (outcome === "rate-limit") {
    return { kind: "model-rate-limit", message: "Model rate limit: this subject was not checked. Try it again in a minute." };
  }
  if (outcome === "invalid-output" || outcome === "unavailable") {
    const message = `We found ${countSources(sourceCount)} but could not check them. Nothing about this subject is shown until it is checked.`;
    return { kind: "model-failed", message };
  }
  if (!hasFindings) {
    const detail =
      sourceCount === 0 ? "Our searches found no pages from this period." : `We read ${countSources(sourceCount)} and found nothing we could confirm.`;
    return { kind: "nothing-found", message: `Nothing significant in these 30 days. ${detail}` };
  }
  return null;
}

function buildSection(subject: Subject, parts: BriefingParts, shown: ReadonlySet<string>): SubjectSection {
  const own = parts.claims.filter((claim) => claim.subjectIds.includes(subject.id));
  const hasFindings = own.some((claim) => claim.status !== "unconfirmed");
  const listedHere = parts.claims.filter(
    (claim) => claim.status !== "unconfirmed" && homeSubjectId(claim, parts.input.subjects) === subject.id,
  );
  const shownClaimIds = listedHere.filter((claim) => shown.has(claim.id)).map((claim) => claim.id);
  const line = parts.writing.written?.subjectLines.find((entry) => entry.subjectId === subject.id)?.line ?? null;
  return {
    subjectId: subject.id,
    line: hasFindings ? line : null,
    shownClaimIds,
    moreCount: listedHere.length - shownClaimIds.length,
    counts: countStatuses(own),
    note: noteFor(subject.id, parts, hasFindings),
  };
}

function snapshotFor(parts: BriefingParts): string | null {
  if (!parts.writing.skipped) {
    return parts.writing.written?.snapshot ?? null;
  }
  const start = format(parseISO(parts.searchWindow.startDate), "d MMM");
  const last = format(parseISO(toUtcDateString(parts.searchWindow.end)), "d MMM");
  return `Nothing significant between ${start} and ${last}. No development in this period could be confirmed from its sources.`;
}

// Questions survive only when tied to a claim the writing call was given.
function tieQuestions(parts: BriefingParts): BriefingResult["questions"] {
  const usable = new Map(parts.claims.filter((claim) => claim.status !== "unconfirmed").map((claim) => [claim.id, claim]));
  return (parts.writing.written?.questions ?? []).flatMap((question) => {
    const claim = usable.get(question.claimId);
    return claim === undefined ? [] : [{ text: question.text, claimId: claim.id, subjectIds: claim.subjectIds }];
  });
}

function citedSources(claims: readonly VerifiedClaim[]): BriefingResult["sources"] {
  const byId = new Map(claims.flatMap((claim) => claim.sources).map((source) => [source.id, source]));
  return [...byId.values()].sort((first, second) => Number(first.id.slice(1)) - Number(second.id.slice(1)));
}

export function assembleBriefing(parts: BriefingParts): BriefingResult {
  const { input, claims, searchWindow } = parts;
  const shown = selectForPage(claims, input.subjects);
  const modelCalls = [...parts.extractions.map((extraction) => extraction.modelCall), parts.writing.modelCall];
  return {
    input,
    window: { startDate: searchWindow.startDate, lastDate: toUtcDateString(searchWindow.end), endDate: searchWindow.endDate },
    generatedAt: parts.now.toISOString(),
    subjects: input.subjects.map((subject) => buildSection(subject, parts, shown)),
    groups: groupSubjects(input.subjects),
    claims: [...claims],
    sharedClaimIds: claims.filter((claim) => claim.status === "verified" && claim.subjectIds.length > 1).map((claim) => claim.id),
    snapshot: snapshotFor(parts),
    questions: tieQuestions(parts),
    openQuestions: keepOpenQuestions(parts.writing.written?.openQuestions.map((question) => question.text) ?? [], knownWords(input, claims)),
    sources: citedSources(claims),
    research: { searchesRun: parts.research.searchesRun, sourcesFound: parts.research.sources.length },
    counts: countStatuses(claims),
    modelCalls: modelCalls.flatMap((call) => (call === null ? [] : [call])),
  };
}
