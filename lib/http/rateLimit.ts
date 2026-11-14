// Per-IP sliding-window limit on subjects researched, since each subject costs searches and a
// model call. Best-effort only: the window lives in this server instance's memory, so on
// serverless hosts each instance keeps its own count and a cold start forgets it.
const SUBJECTS_PER_WINDOW = 15;
const WINDOW_MILLISECONDS = 10 * 60 * 1000;
// Bounds memory if many addresses pass through; expired entries are dropped at that size.
const SWEEP_AT_KEYS = 10_000;

type Usage = { at: number; amount: number };
type Decision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = { take: (key: string, amount: number, now: number) => Decision };

export function createSubjectRateLimiter(limit = SUBJECTS_PER_WINDOW, windowMilliseconds = WINDOW_MILLISECONDS): RateLimiter {
  const usageByKey = new Map<string, Usage[]>();

  const sweep = (now: number) => {
    for (const [key, usage] of usageByKey) {
      if (usage.every((entry) => entry.at <= now - windowMilliseconds)) {
        usageByKey.delete(key);
      }
    }
  };

  // When over the limit, wait until enough of the oldest usage has left the window.
  const retryAfter = (recent: readonly Usage[], excess: number, now: number): number => {
    let freed = 0;
    for (const entry of recent) {
      freed += entry.amount;
      if (freed >= excess) {
        return Math.max(1, Math.ceil((entry.at + windowMilliseconds - now) / 1000));
      }
    }
    return Math.ceil(windowMilliseconds / 1000);
  };

  return {
    take(key, amount, now) {
      if (usageByKey.size >= SWEEP_AT_KEYS) {
        sweep(now);
      }
      const recent = (usageByKey.get(key) ?? []).filter((entry) => entry.at > now - windowMilliseconds);
      const used = recent.reduce((total, entry) => total + entry.amount, 0);
      if (used + amount > limit) {
        usageByKey.set(key, recent);
        return { allowed: false, retryAfterSeconds: retryAfter(recent, used + amount - limit, now) };
      }
      usageByKey.set(key, [...recent, { at: now, amount }]);
      return { allowed: true };
    },
  };
}
