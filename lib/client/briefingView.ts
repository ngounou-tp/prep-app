import { homeSubjectId } from "@/lib/briefing/pageBudget";
import type { BriefingResult, ClaimStatus, Subject, SubjectNote, VerifiedClaim } from "@/lib/types";

export type SubjectFilter = "everyone" | string;

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  verified: "Verified",
  "single-source": "Single source",
  unconfirmed: "Could not verify",
};

const FAILED_KINDS: ReadonlySet<SubjectNote["kind"]> = new Set(["research-failed", "model-rate-limit", "model-failed", "not-completed"]);

// Only http and https become links; anything else from a source is shown as text.
export function safeHref(url: string): string | null {
  if (!URL.canParse(url)) {
    return null;
  }
  const parsed = new URL(url);
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

export function subjectsById(briefing: BriefingResult): Map<string, Subject> {
  return new Map(briefing.input.subjects.map((subject) => [subject.id, subject]));
}

export function groupLayout(briefing: BriefingResult): { subjectId: string; nested: boolean }[] {
  return briefing.groups.flatMap((group) =>
    group.companySubjectId === null
      ? group.personSubjectIds.map((subjectId) => ({ subjectId, nested: false }))
      : [{ subjectId: group.companySubjectId, nested: false }, ...group.personSubjectIds.map((subjectId) => ({ subjectId, nested: true }))],
  );
}

// The claim's own date, else the date of the source its quote came from, else any cited date.
export function developmentDate(claim: VerifiedClaim): string | null {
  const quoteSource = claim.sources.find((source) => source.id === claim.quoteSourceId);
  return claim.date ?? quoteSource?.publishedDate ?? claim.sources.find((source) => source.publishedDate !== null)?.publishedDate ?? null;
}

function newestFirst(first: VerifiedClaim, second: VerifiedClaim): number {
  return (developmentDate(second) ?? "").localeCompare(developmentDate(first) ?? "");
}

// The developments listed under one subject, newest first: the pipeline's page selection,
// plus the rest when "more found" is expanded. A shared claim appears under one subject only.
export function developmentsFor(briefing: BriefingResult, subjectId: string, expanded: boolean): { claim: VerifiedClaim; extra: boolean }[] {
  const section = briefing.subjects.find((candidate) => candidate.subjectId === subjectId);
  const shown = new Set(section?.shownClaimIds ?? []);
  return briefing.claims
    .filter((claim) => claim.status !== "unconfirmed" && homeSubjectId(claim, briefing.input.subjects) === subjectId)
    .filter((claim) => shown.has(claim.id) || expanded)
    .sort(newestFirst)
    .map((claim) => ({ claim, extra: !shown.has(claim.id) }));
}

export function matchesFilter(subjectIds: readonly string[], filter: SubjectFilter): boolean {
  return filter === "everyone" || subjectIds.includes(filter);
}

// The developments on screen, in page order: what "Previous" and "Next development" step through.
export function visibleDevelopmentIds(briefing: BriefingResult, filter: SubjectFilter, expanded: ReadonlySet<string>): string[] {
  return groupLayout(briefing).flatMap(({ subjectId }) =>
    developmentsFor(briefing, subjectId, expanded.has(subjectId))
      .filter(({ claim }) => matchesFilter(claim.subjectIds, filter))
      .map(({ claim }) => claim.id),
  );
}

export function alsoAbout(claim: VerifiedClaim, listedUnder: string, subjects: ReadonlyMap<string, Subject>): string[] {
  return claim.subjectIds.filter((id) => id !== listedUnder).flatMap((id) => subjects.get(id)?.name ?? []);
}

export function missingSubjects(briefing: BriefingResult): { subjectId: string; note: SubjectNote }[] {
  return briefing.subjects.flatMap((section) =>
    section.note !== null && FAILED_KINDS.has(section.note.kind) ? [{ subjectId: section.subjectId, note: section.note }] : [],
  );
}

// "Nothing found" for the whole meeting: no claim survived and no subject failed.
export function isEmptyBriefing(briefing: BriefingResult): boolean {
  return briefing.counts.verified + briefing.counts.singleSource === 0 && missingSubjects(briefing).length === 0;
}

export function categoryLabel(category: VerifiedClaim["category"]): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function namesList(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
