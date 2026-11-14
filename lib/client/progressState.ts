// Turns the stream's progress events into what the progress screen shows. Pure: events in,
// state out, so every row, step and estimate can be tested without a browser.
import type { BriefingInput, ProgressEvent } from "@/lib/types";

type CheckingEvent = Extract<ProgressEvent, { type: "checking" }>;
type ExtractedOutcome = Extract<ProgressEvent, { type: "extracted" }>["outcome"];

export type SubjectStage = "searching" | "reading" | "retrying" | "done" | "nothing-found" | "not-finished";

export type SubjectProgress = {
  subjectId: string;
  queryCount: number;
  sourceCount: number | null;
  stage: SubjectStage;
  retryWaitSeconds: number | null;
  failure: ExtractedOutcome | null;
  claimsKept: number;
};

export type ProgressState = {
  subjects: SubjectProgress[];
  sourceDates: Map<string, string | null>;
  checked: number;
  totalClaims: number | null;
  latestCheck: CheckingEvent | null;
  writing: boolean;
  done: boolean;
};

export type StepStatus = "done" | "current" | "waiting";

export function initialProgress(input: BriefingInput): ProgressState {
  return {
    subjects: input.subjects.map((subject) => ({
      subjectId: subject.id,
      queryCount: 0,
      sourceCount: null,
      stage: "searching",
      retryWaitSeconds: null,
      failure: null,
      claimsKept: 0,
    })),
    sourceDates: new Map(),
    checked: 0,
    totalClaims: null,
    latestCheck: null,
    writing: false,
    done: false,
  };
}

function updateSubject(state: ProgressState, subjectId: string, change: (subject: SubjectProgress) => SubjectProgress): ProgressState {
  return { ...state, subjects: state.subjects.map((subject) => (subject.subjectId === subjectId ? change(subject) : subject)) };
}

function stageAfterExtraction(outcome: ExtractedOutcome): SubjectStage {
  if (outcome === "ok") {
    return "done";
  }
  return outcome === "no-sources" ? "nothing-found" : "not-finished";
}

function withSources(state: ProgressState, event: Extract<ProgressEvent, { type: "sources" }>): ProgressState {
  const sourceDates = new Map(state.sourceDates);
  event.sourceIds.forEach((sourceId, index) => sourceDates.set(sourceId, event.publishedDates[index] ?? null));
  const updated = updateSubject(state, event.subjectId, (subject) => ({ ...subject, sourceCount: event.count, stage: "reading" }));
  return { ...updated, sourceDates };
}

function withCheck(state: ProgressState, event: CheckingEvent): ProgressState {
  const kept = event.claim.status !== "unconfirmed";
  const subjects = state.subjects.map((subject) =>
    kept && event.subjectIds.includes(subject.subjectId) ? { ...subject, claimsKept: subject.claimsKept + 1 } : subject,
  );
  return { ...state, subjects, checked: event.checked, totalClaims: event.total, latestCheck: event };
}

export function applyProgress(state: ProgressState, event: ProgressEvent): ProgressState {
  switch (event.type) {
    case "searching":
      return updateSubject(state, event.subjectId, (subject) => ({ ...subject, queryCount: event.queryCount }));
    case "sources":
      return withSources(state, event);
    case "retrying":
      return updateSubject(state, event.subjectId, (subject) => ({ ...subject, stage: "retrying", retryWaitSeconds: event.waitSeconds }));
    case "extracted":
      return updateSubject(state, event.subjectId, (subject) => ({
        ...subject,
        stage: stageAfterExtraction(event.outcome),
        failure: event.outcome === "ok" || event.outcome === "no-sources" ? null : event.outcome,
      }));
    case "checking":
      return withCheck(state, event);
    case "writing":
      return { ...state, writing: true };
    case "done":
      return { ...state, done: true, writing: false };
  }
}

const FINISHED: ReadonlySet<SubjectStage> = new Set(["done", "nothing-found", "not-finished"]);

export function stepStatuses(state: ProgressState): { search: StepStatus; read: StepStatus; check: StepStatus; write: StepStatus } {
  const searched = state.subjects.every((subject) => subject.sourceCount !== null);
  const read = searched && state.subjects.every((subject) => FINISHED.has(subject.stage));
  const checked = read && (state.writing || state.done);
  return {
    search: searched ? "done" : "current",
    read: read ? "done" : searched ? "current" : "waiting",
    check: checked ? "done" : read ? "current" : "waiting",
    write: state.done ? "done" : state.writing ? "current" : "waiting",
  };
}

export function searchesPlanned(state: ProgressState): number {
  return state.subjects.reduce((total, subject) => total + subject.queryCount, 0);
}

// How far along the whole run is, from 0 to 1. Reading (one model call per subject) is the
// longest stage, so it carries most of the weight.
export function progressFraction(state: ProgressState): number {
  const count = state.subjects.length;
  const searched = state.subjects.filter((subject) => subject.sourceCount !== null).length / count;
  const read = state.subjects.filter((subject) => FINISHED.has(subject.stage)).length / count;
  const step = stepStatuses(state);
  return Math.min(1, 0.05 + 0.15 * searched + 0.55 * read + (step.check === "done" ? 0.1 : 0) + (state.done ? 0.15 : state.writing ? 0.05 : 0));
}

// Seconds left from the pace so far, capped by the server's 55-second budget. Null while too
// little has happened to estimate honestly.
export function estimateSecondsLeft(state: ProgressState, elapsedSeconds: number): number | null {
  const fraction = progressFraction(state);
  if (state.done || fraction < 0.2 || elapsedSeconds <= 0) {
    return null;
  }
  const projected = (elapsedSeconds * (1 - fraction)) / fraction;
  const ceiling = Math.max(0, 55 - elapsedSeconds);
  return Math.max(5, Math.ceil(Math.min(projected, ceiling) / 5) * 5);
}

// Sources per day of the window, by publish date; undated sources are not placed.
export function sourcesByDay(state: ProgressState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of state.sourceDates.values()) {
    if (date !== null) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }
  return counts;
}
