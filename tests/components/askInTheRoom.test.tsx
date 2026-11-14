// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AskInTheRoom } from "@/components/result/Summary";
import { subjectsById } from "@/lib/client/briefingView";
import { buildBriefing, company, fixtureClaim } from "@/tests/support/briefingFixture";

const claims = Array.from({ length: 6 }, (_, index) => fixtureClaim(`C${index + 1}`, ["c1"]));
const briefing = buildBriefing({
  subjects: [company("c1", "Northwind Freight")],
  claims,
  written: {
    snapshot: "Summary.",
    subjectLines: [],
    questions: claims.map((claim) => ({ text: `Why ${claim.id}?`, claimId: claim.id })),
    openQuestions: [{ text: "What would success look like for you?" }],
  },
});

afterEach(cleanup);

describe("AskInTheRoom", () => {
  it("offers more questions, then shows the rest and the ones beyond the findings", () => {
    render(<AskInTheRoom briefing={briefing} subjects={subjectsById(briefing)} filter="everyone" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByText("What would success look like for you?")).toBeNull();
    const more = screen.getByRole("button", { name: "Want more questions? 3 more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getByText("Why C6?")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Beyond the findings" })).toBeTruthy();
    expect(screen.getByText("What would success look like for you?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fewer questions" }).getAttribute("aria-expanded")).toBe("true");
  });
});
