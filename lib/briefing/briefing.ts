// Orchestrator: the only module that runs window, search, clean, extract, verify and write in order.
import "server-only";
import { assembleBriefing, type SubjectExtraction, type WritingResult } from "@/lib/briefing/assemble";
import { readEnvironment, type EnvironmentSource } from "@/lib/config/env";
import { isFixtureMode, loadFixtureBriefing } from "@/lib/config/fixtures";
import { createModelClient, type ModelClient } from "@/lib/model/llm";
import { checkingEvents, searchingEvents, sourcesEvents } from "@/lib/briefing/progress";
import { extractPrompt, formatClaims, formatSources, writePrompt } from "@/lib/model/prompts";
import { planSearches } from "@/lib/research/queries";
import { researchAll } from "@/lib/research/tavily";
import { createTimeBudget, TIME_BUDGET_MILLISECONDS, type TimeBudget } from "@/lib/briefing/timeBudget";
import {
  extractionSchema,
  writtenSchema,
  type BriefingInput,
  type BriefingResult,
  type Claim,
  type ProgressEvent,
  type Source,
  type Subject,
  type VerifiedClaim,
} from "@/lib/types";
import { verifyClaims } from "@/lib/briefing/verify";
import { researchWindow } from "@/lib/research/window";

type BriefingOptions = {
  environmentSource?: EnvironmentSource;
  fixturePath?: string;
  onProgress?: (event: ProgressEvent) => void;
  // Aborted when the client disconnects: no new work starts and in-flight calls stop.
  signal?: AbortSignal;
  // Injected by tests so time, rate-limit waits and call pacing need no real waiting.
  clock?: () => number;
  timeBudgetMilliseconds?: number;
  pause?: (milliseconds: number) => Promise<void>;
};

type ExtractionWithClaims = SubjectExtraction & { claims: Claim[] };
type ExtractionContext = {
  model: ModelClient;
  subjects: readonly Subject[];
  sources: readonly Source[];
  budget: TimeBudget;
  cancel: AbortSignal;
  emit: (event: ProgressEvent) => void;
};

const EXTRACTION_OUTCOMES = { "rate-limit": "rate-limit", "invalid-output": "invalid-output", unavailable: "unavailable", cancelled: "not-completed" } as const;
const ANNOUNCED_OUTCOMES = {
  ok: "ok",
  "no-sources": "no-sources",
  "rate-limit": "rate-limit",
  "invalid-output": "failed",
  unavailable: "failed",
  "not-completed": "not-completed",
} as const;

function announceExtracted(extraction: ExtractionWithClaims, emit: ExtractionContext["emit"]): ExtractionWithClaims {
  emit({ type: "extracted", subjectId: extraction.subjectId, outcome: ANNOUNCED_OUTCOMES[extraction.outcome], claimCount: extraction.claims.length });
  return extraction;
}

// Each call sees only this subject's sources and the other subjects' names, so it can skip them.
async function extractSubject(subject: Subject, context: ExtractionContext): Promise<ExtractionWithClaims> {
  const own = context.sources.filter((source) => source.subjectIds.includes(subject.id));
  if (own.length === 0) {
    return { subjectId: subject.id, outcome: "no-sources", modelCall: null, claims: [] };
  }
  const otherNames = context.subjects.filter((other) => other.id !== subject.id).map((other) => other.name);
  const result = await context.model.chatJson(extractPrompt(subject, otherNames), formatSources(subject.name, own), extractionSchema, {
    cancel: context.cancel,
    shouldStart: context.budget.canStartExtraction,
    onRetry: (waitMilliseconds) => context.emit({ type: "retrying", subjectId: subject.id, waitSeconds: Math.ceil(waitMilliseconds / 1000) }),
  });
  if (!result.ok) {
    return { subjectId: subject.id, outcome: EXTRACTION_OUTCOMES[result.failure], modelCall: null, claims: [] };
  }
  return {
    subjectId: subject.id,
    outcome: "ok",
    modelCall: { purpose: "extract", subjectId: subject.id, ...result.routing },
    claims: result.value.claims.map((claim) => ({ ...claim, subjectIds: [subject.id] })),
  };
}

async function extractAll(context: ExtractionContext): Promise<ExtractionWithClaims[]> {
  // Each subject is announced as soon as its own call finishes, not when all have finished.
  const settled = await Promise.allSettled(
    context.subjects.map(async (subject) => announceExtracted(await extractSubject(subject, context), context.emit)),
  );
  return settled.map((outcome, index): ExtractionWithClaims => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // Only the error's type: an unexpected error's message could carry the Bifrost URL.
    const errorType = outcome.reason instanceof Error ? outcome.reason.name : "unknown error";
    console.error(`Extraction failed unexpectedly for ${context.subjects[index].id}: ${errorType}`);
    const failed: ExtractionWithClaims = { subjectId: context.subjects[index].id, outcome: "unavailable", modelCall: null, claims: [] };
    return announceExtracted(failed, context.emit);
  });
}

// Only verified and single-source claims reach the writing call; with none, no call is made.
async function writeMeeting(
  model: ModelClient,
  input: BriefingInput,
  claims: readonly VerifiedClaim[],
  budget: TimeBudget,
  options: BriefingOptions,
): Promise<WritingResult> {
  const usable = claims.filter((claim) => claim.status !== "unconfirmed");
  if (usable.length === 0) {
    return { skipped: true, written: null, modelCall: null };
  }
  if (!budget.canStartWriting()) {
    return { skipped: false, written: null, modelCall: null };
  }
  options.onProgress?.({ type: "writing" });
  const result = await model.chatJson(writePrompt(input), formatClaims(input.subjects, usable), writtenSchema, {
    cancel: budget.writingSignal(options.signal),
    shouldStart: budget.canStartWriting,
  });
  if (!result.ok) {
    return { skipped: false, written: null, modelCall: null };
  }
  return { skipped: false, written: result.value, modelCall: { purpose: "write", subjectId: null, ...result.routing } };
}

export async function createBriefing(input: BriefingInput, now: Date, options: BriefingOptions = {}): Promise<BriefingResult> {
  const environmentSource = options.environmentSource ?? process.env;
  const emit = (events: readonly ProgressEvent[]) => events.forEach((event) => options.onProgress?.(event));
  if (isFixtureMode(environmentSource)) {
    const fixture = await loadFixtureBriefing(options.fixturePath);
    emit([{ type: "done" }]);
    return fixture;
  }
  const environment = readEnvironment(environmentSource);
  const budget = createTimeBudget(options.timeBudgetMilliseconds ?? TIME_BUDGET_MILLISECONDS, options.clock ?? Date.now);
  const workSignal = budget.workSignal(options.signal);
  const searchWindow = researchWindow(input.meetingAt, now);

  emit(searchingEvents(input.subjects, planSearches(input.subjects)));
  const research = await researchAll(input.subjects, searchWindow, environment, workSignal);
  emit(sourcesEvents(input.subjects, research.sources));

  const model = createModelClient(environment, options.pause);
  const extractions = await extractAll({
    model,
    subjects: input.subjects,
    sources: research.sources,
    budget,
    cancel: workSignal,
    emit: (event) => emit([event]),
  });
  const claims = verifyClaims(extractions.flatMap((extraction) => extraction.claims), research.sources);
  emit(checkingEvents(claims));

  const writing = await writeMeeting(model, input, claims, budget, options);
  emit([{ type: "done" }]);
  return assembleBriefing({ input, searchWindow, now, research, extractions, claims, writing });
}
