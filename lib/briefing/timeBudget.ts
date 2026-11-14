// Keeps a briefing inside the route's 60-second limit. Research and extraction share one
// deadline that leaves room for the writing call; nothing new starts once too little is left.
export const TIME_BUDGET_MILLISECONDS = 55_000;
const WRITING_RESERVE_MILLISECONDS = 12_000;
const MIN_EXTRACTION_MILLISECONDS = 8_000;
const MIN_WRITING_MILLISECONDS = 5_000;

export type TimeBudget = ReturnType<typeof createTimeBudget>;

// `clock` is injected so tests can move time without waiting.
export function createTimeBudget(totalMilliseconds: number, clock: () => number) {
  const startedAt = clock();
  const left = () => Math.max(0, totalMilliseconds - (clock() - startedAt));
  const workLeft = () => Math.max(0, left() - WRITING_RESERVE_MILLISECONDS);
  return {
    canStartExtraction: () => workLeft() >= MIN_EXTRACTION_MILLISECONDS,
    canStartWriting: () => left() >= MIN_WRITING_MILLISECONDS,
    // Fires when research and extraction must stop, or when the client goes away.
    workSignal: (disconnect?: AbortSignal) => withDeadline(workLeft(), disconnect),
    // Fires when the whole budget is spent, or when the client goes away.
    writingSignal: (disconnect?: AbortSignal) => withDeadline(left(), disconnect),
  };
}

function withDeadline(milliseconds: number, disconnect?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(Math.max(1, milliseconds));
  return disconnect === undefined ? deadline : AbortSignal.any([deadline, disconnect]);
}
