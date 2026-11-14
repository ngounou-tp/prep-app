type Task<Result> = () => Promise<Result>;

// Returns a wrapper that lets at most `maxInFlight` tasks run at once; the rest wait in order.
export function createLimiter(maxInFlight: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function limit<Result>(task: Task<Result>): Promise<Result> {
    if (active < maxInFlight) {
      active += 1;
    } else {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      // Hand the slot straight to the next waiter so a newcomer cannot slip in between.
      const next = waiting.shift();
      if (next === undefined) {
        active -= 1;
      } else {
        next();
      }
    }
  };
}

// Like createLimiter, and also waits until `pauseMilliseconds` have passed since the previous
// task finished before starting the next one. `pause` is injected so tests need not wait.
export function createPacedLimiter(
  maxInFlight: number,
  pauseMilliseconds: number,
  pause: (milliseconds: number) => Promise<void>,
) {
  const limit = createLimiter(maxInFlight);
  let lastFinishedAt: number | null = null;
  return function enqueue<Result>(task: Task<Result>): Promise<Result> {
    return limit(async () => {
      const remaining = lastFinishedAt === null ? 0 : lastFinishedAt + pauseMilliseconds - Date.now();
      if (remaining > 0) {
        await pause(remaining);
      }
      try {
        return await task();
      } finally {
        lastFinishedAt = Date.now();
      }
    });
  };
}
