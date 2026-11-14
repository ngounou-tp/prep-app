import { describe, expect, it } from "vitest";
import { applyProgress, estimateSecondsLeft, initialProgress, sourcesByDay, stepStatuses, type ProgressState } from "@/lib/client/progressState";
import { stageAnnouncement, stepSummaries } from "@/lib/client/progressSteps";
import type { BriefingInput, ProgressEvent } from "@/lib/types";
import { company, person } from "@/tests/support/briefingFixture";

const input: BriefingInput = {
  meetingAt: "2026-11-19T10:00:00.000Z",
  meetingType: "sales-call",
  meetingTopic: undefined,
  subjects: [company("s1", "Northwind Freight"), person("s2", "Jonas Weber", "Harbor Capital")],
};

function run(events: ProgressEvent[]): ProgressState {
  return events.reduce(applyProgress, initialProgress(input));
}

const searched: ProgressEvent[] = [
  { type: "searching", subjectId: "s1", queryCount: 3 },
  { type: "searching", subjectId: "s2", queryCount: 3 },
  { type: "sources", subjectId: "s1", count: 2, sourceIds: ["S1", "S2"], publishedDates: ["2026-10-21", "2026-10-21"] },
  { type: "sources", subjectId: "s2", count: 2, sourceIds: ["S2", "S3"], publishedDates: ["2026-10-21", null] },
];

describe("progress state", () => {
  it("moves through search, read, check and write with live counts", () => {
    expect(stepSummaries(run([])).map((step) => step.status)).toEqual(["current", "waiting", "waiting", "waiting"]);
    const reading = run(searched);
    expect(stepSummaries(reading).slice(0, 2)).toEqual([
      { label: "Search", status: "done", detail: "6 searches run" },
      { label: "Read", status: "current", detail: "Reading 3 sources" },
    ]);
    const checking = run([
      ...searched,
      { type: "extracted", subjectId: "s1", outcome: "ok", claimCount: 1 },
      { type: "extracted", subjectId: "s2", outcome: "ok", claimCount: 1 },
      {
        type: "checking",
        subjectIds: ["s1"],
        checked: 1,
        total: 2,
        claim: { text: "Opened a hub.", status: "verified" },
        checks: { quoteSourceId: "S1", quoteDomain: "news.example", publishedDate: "2026-10-21", secondSourceId: "S2" },
      },
    ]);
    expect(stepSummaries(checking)[2]).toEqual({ label: "Check", status: "current", detail: "1 of 2 claims checked" });
    expect(stageAnnouncement(checking)).toBe("Check: 1 of 2 claims checked.");
    expect(stepStatuses(run([...searched, { type: "writing" }, { type: "done" }])).write).toBe("done");
  });

  it("shows a retry and a failure on one subject while the other continues", () => {
    const state = run([
      ...searched,
      { type: "retrying", subjectId: "s2", waitSeconds: 8 },
      { type: "extracted", subjectId: "s1", outcome: "ok", claimCount: 2 },
    ]);
    expect(state.subjects.map((subject) => subject.stage)).toEqual(["done", "retrying"]);
    expect(state.subjects[1]?.retryWaitSeconds).toBe(8);
    const failed = applyProgress(state, { type: "extracted", subjectId: "s2", outcome: "rate-limit", claimCount: 0 });
    expect(failed.subjects[1]).toMatchObject({ stage: "not-finished", failure: "rate-limit" });
  });

  it("counts a source shared by two subjects once, by day", () => {
    expect([...sourcesByDay(run(searched))]).toEqual([["2026-10-21", 2]]);
  });

  it("estimates time left only once there is real progress", () => {
    expect(estimateSecondsLeft(run([]), 3)).toBeNull();
    const estimate = estimateSecondsLeft(run(searched), 10);
    expect(estimate).not.toBeNull();
    expect((estimate ?? 0) % 5).toBe(0);
    expect(estimate ?? 0).toBeLessThanOrEqual(45);
    expect(estimateSecondsLeft(run([...searched, { type: "done" }]), 30)).toBeNull();
  });
});
