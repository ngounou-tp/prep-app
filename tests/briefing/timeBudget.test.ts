import { describe, expect, it } from "vitest";
import { createTimeBudget } from "@/lib/briefing/timeBudget";

describe("createTimeBudget", () => {
  it("stops starting extraction when less than 8 seconds of work time remain before the writing reserve", () => {
    let now = 0;
    const budget = createTimeBudget(55_000, () => now);
    expect(budget.canStartExtraction()).toBe(true);
    now = 35_000;
    expect(budget.canStartExtraction()).toBe(true);
    now = 35_001;
    expect(budget.canStartExtraction()).toBe(false);
  });

  it("allows writing until fewer than 5 seconds remain", () => {
    let now = 0;
    const budget = createTimeBudget(55_000, () => now);
    now = 50_000;
    expect(budget.canStartWriting()).toBe(true);
    now = 50_001;
    expect(budget.canStartWriting()).toBe(false);
  });

  it("aborts the work signal when the client disconnects", () => {
    const disconnect = new AbortController();
    const signal = createTimeBudget(55_000, () => 0).workSignal(disconnect.signal);
    expect(signal.aborted).toBe(false);
    disconnect.abort();
    expect(signal.aborted).toBe(true);
  });
});
