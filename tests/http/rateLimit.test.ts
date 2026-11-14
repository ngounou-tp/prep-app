import { describe, expect, it } from "vitest";
import { createSubjectRateLimiter } from "@/lib/http/rateLimit";

const MINUTE = 60_000;

describe("createSubjectRateLimiter", () => {
  it("allows 15 subjects in 10 minutes per address, then refuses with a retry time", () => {
    const limiter = createSubjectRateLimiter();
    expect(limiter.take("203.0.113.1", 5, 0)).toEqual({ allowed: true });
    expect(limiter.take("203.0.113.1", 5, MINUTE)).toEqual({ allowed: true });
    expect(limiter.take("203.0.113.1", 5, 2 * MINUTE)).toEqual({ allowed: true });
    expect(limiter.take("203.0.113.1", 1, 3 * MINUTE)).toEqual({ allowed: false, retryAfterSeconds: 7 * 60 });
  });

  it("counts each address separately", () => {
    const limiter = createSubjectRateLimiter();
    limiter.take("203.0.113.1", 15, 0);
    expect(limiter.take("203.0.113.2", 5, 0)).toEqual({ allowed: true });
  });

  it("slides: usage older than the window no longer counts", () => {
    const limiter = createSubjectRateLimiter();
    limiter.take("203.0.113.1", 10, 0);
    limiter.take("203.0.113.1", 5, 5 * MINUTE);
    expect(limiter.take("203.0.113.1", 5, 10 * MINUTE + 1)).toEqual({ allowed: true });
    expect(limiter.take("203.0.113.1", 6, 10 * MINUTE + 2).allowed).toBe(false);
  });

  it("does not record a refused request", () => {
    const limiter = createSubjectRateLimiter(3, 10 * MINUTE);
    expect(limiter.take("203.0.113.1", 5, 0).allowed).toBe(false);
    expect(limiter.take("203.0.113.1", 3, 0)).toEqual({ allowed: true });
  });
});
