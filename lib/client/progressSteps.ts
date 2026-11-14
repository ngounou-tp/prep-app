import { searchesPlanned, stepStatuses, type ProgressState, type StepStatus } from "./progressState";

export type StepSummary = { label: string; detail: string; status: StepStatus };

function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

function checkDetail(state: ProgressState, status: StepStatus): string {
  if (status === "waiting") {
    return "Each claim against its source";
  }
  if (state.totalClaims === null) {
    return status === "done" ? "No claims to check" : "Checking claims";
  }
  return status === "done" ? `${plural(state.totalClaims, "claim")} checked` : `${state.checked} of ${state.totalClaims} claims checked`;
}

export function stepSummaries(state: ProgressState): StepSummary[] {
  const status = stepStatuses(state);
  const searches = searchesPlanned(state);
  const sources = state.sourceDates.size;
  return [
    { label: "Search", status: status.search, detail: status.search === "done" ? `${plural(searches, "search", "searches")} run` : searches === 0 ? "Starting the searches" : `Running ${plural(searches, "search", "searches")}` },
    { label: "Read", status: status.read, detail: status.read === "waiting" ? "The sources we keep" : status.read === "done" ? `${plural(sources, "source")} kept` : `Reading ${plural(sources, "source")}` },
    { label: "Check", status: status.check, detail: checkDetail(state, status.check) },
    { label: "Write", status: status.write, detail: status.write === "done" ? "Your one page is ready" : status.write === "current" ? "Writing your one page" : "Your one page" },
  ];
}

// "Read: Reading 26 sources." Changes only when a step or its count changes.
export function stageAnnouncement(state: ProgressState): string {
  const current = stepSummaries(state).find((step) => step.status === "current");
  return current === undefined ? (state.done ? "Your briefing is ready." : "") : `${current.label}: ${current.detail}.`;
}
