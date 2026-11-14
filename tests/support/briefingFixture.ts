// Builds realistic BriefingResult values for page tests by running the real assembly step.
// Invented names and .example domains only.
import { assembleBriefing, type SubjectExtraction } from "@/lib/briefing/assemble";
import { researchWindow } from "@/lib/research/window";
import type { BriefingResult, ClaimStatus, Source, Subject, VerifiedClaim, Written } from "@/lib/types";

export const FIXTURE_NOW = new Date("2026-11-11T08:00:00Z");
export const FIXTURE_WINDOW = researchWindow("2026-11-19T10:00:00Z", FIXTURE_NOW);

export function company(id: string, name: string): Subject {
  return { id, name, type: "company", company: undefined, context: undefined };
}

export function person(id: string, name: string, employer?: string): Subject {
  return { id, name, type: "person", company: employer, context: undefined };
}

export function fixtureSource(id: string, subjectIds: string[], overrides: Partial<Source> = {}): Source {
  return {
    id,
    title: `Headline ${id}`,
    url: `https://news.example/${id.toLowerCase()}`,
    domain: "news.example",
    content: `Report ${id}. Northwind Freight said it has opened a cold-chain hub in Rotterdam this month.`,
    publishedDate: "2026-10-21",
    score: 0.5,
    subjectIds,
    ...overrides,
  };
}

type ClaimOptions = { status?: ClaimStatus; date?: string | null; text?: string; sources?: Source[] };

export function fixtureClaim(id: string, subjectIds: string[], options: ClaimOptions = {}): VerifiedClaim {
  const sources = options.sources ?? [fixtureSource(`S${id.slice(1)}`, subjectIds)];
  return {
    id,
    text: options.text ?? `Development ${id}.`,
    category: "news",
    date: options.date === undefined ? "2026-10-21" : options.date,
    sourceIds: sources.map((source) => source.id),
    quote: "it has opened a cold-chain hub in Rotterdam",
    subjectIds,
    status: options.status ?? "verified",
    quoteSourceId: options.status === "unconfirmed" ? null : (sources[0]?.id ?? null),
    sources,
  };
}

type BuildOptions = {
  subjects: Subject[];
  claims?: VerifiedClaim[];
  outcomes?: Record<string, SubjectExtraction["outcome"]>;
  written?: Written | null;
};

export function buildBriefing({ subjects, claims = [], outcomes = {}, written }: BuildOptions): BriefingResult {
  const sources = [...new Map(claims.flatMap((claim) => claim.sources).map((source) => [source.id, source])).values()];
  const usable = claims.filter((claim) => claim.status !== "unconfirmed");
  const defaultWritten: Written = {
    snapshot: "Developments this month are listed below.",
    subjectLines: [],
    questions: usable.slice(0, 3).map((claim) => ({ text: `What changed after ${claim.id}?`, claimId: claim.id })),
    openQuestions: [],
  };
  return assembleBriefing({
    input: { meetingAt: "2026-11-19T10:00:00.000Z", meetingType: "sales-call", meetingTopic: undefined, subjects },
    searchWindow: FIXTURE_WINDOW,
    now: FIXTURE_NOW,
    research: { sources, failedSubjectIds: [], unfinishedSubjectIds: [], searchesRun: 9 },
    extractions: subjects.map((subject) => ({ subjectId: subject.id, outcome: outcomes[subject.id] ?? "ok", modelCall: null })),
    claims,
    writing: { skipped: usable.length === 0, written: written === undefined ? defaultWritten : written, modelCall: null },
  });
}
