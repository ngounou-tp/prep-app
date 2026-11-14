// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressView } from "@/components/progress/ProgressView";
import { applyProgress, initialProgress } from "@/lib/client/progressState";
import { researchWindow } from "@/lib/research/window";
import type { BriefingInput, ProgressEvent } from "@/lib/types";
import { company, person } from "@/tests/support/briefingFixture";

const input: BriefingInput = {
  meetingAt: "2026-11-19T10:00:00.000Z",
  meetingType: "sales-call",
  meetingTopic: undefined,
  subjects: [company("s1", "Northwind Freight"), person("s2", "Jonas Weber", "Harbor Capital")],
};

const events: ProgressEvent[] = [
  { type: "searching", subjectId: "s1", queryCount: 3 },
  { type: "searching", subjectId: "s2", queryCount: 3 },
  { type: "sources", subjectId: "s1", count: 2, sourceIds: ["S1", "S2"], publishedDates: ["2026-10-21", "2026-11-02"] },
  { type: "sources", subjectId: "s2", count: 1, sourceIds: ["S3"], publishedDates: ["2026-10-29"] },
  { type: "extracted", subjectId: "s1", outcome: "ok", claimCount: 1 },
  { type: "retrying", subjectId: "s2", waitSeconds: 8 },
];

afterEach(cleanup);

describe("ProgressView", () => {
  it("shows the stepper, each subject's stage in words and a progress bar per subject", () => {
    const progress = events.reduce(applyProgress, initialProgress(input));
    render(<ProgressView input={input} progress={progress} startedAt={null} window={researchWindow(input.meetingAt, new Date("2026-11-11T08:00:00Z"))} />);
    expect(screen.getByRole("heading", { level: 1, name: "Reading the last 30 days for your meeting" })).toBeTruthy();
    expect(screen.getByText("6 searches run")).toBeTruthy();
    expect(screen.getByText("Retrying")).toBeTruthy();
    expect(screen.getByText(/model busy, trying again in 8 s/)).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.queryByText(/seconds left/)).toBeNull();
    expect(screen.getByText("3 found")).toBeTruthy();
  });

  it("shows the claim being checked with the checks it passed and its badge", () => {
    const progress = applyProgress(events.reduce(applyProgress, initialProgress(input)), {
      type: "checking",
      subjectIds: ["s1"],
      checked: 1,
      total: 1,
      claim: { text: "Opened a cold-chain hub in Rotterdam.", status: "verified" },
      checks: { quoteSourceId: "S1", quoteDomain: "news.example", publishedDate: "2026-10-21", secondSourceId: "S2" },
    });
    render(<ProgressView input={input} progress={progress} startedAt={null} window={null} />);
    expect(screen.getByText("“Opened a cold-chain hub in Rotterdam.”")).toBeTruthy();
    expect(screen.getByText("Quote found in S1, news.example")).toBeTruthy();
    expect(screen.getByText("Confirmed by a second site, S2")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
  });
});
