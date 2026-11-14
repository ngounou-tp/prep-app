import { describe, expect, it } from "vitest";
import { QUESTIONS_SHOWN_FIRST, questionSets } from "@/lib/client/questions";
import { buildBriefing, company, fixtureClaim } from "@/tests/support/briefingFixture";

const claims = Array.from({ length: 6 }, (_, index) => fixtureClaim(`C${index + 1}`, ["c1"]));

function briefingWith(questionCount: number, openQuestions: string[]) {
  return buildBriefing({
    subjects: [company("c1", "Northwind Freight")],
    claims,
    written: {
      snapshot: "Summary.",
      subjectLines: [],
      questions: claims.slice(0, questionCount).map((claim) => ({ text: `Why ${claim.id}?`, claimId: claim.id })),
      openQuestions: openQuestions.map((text) => ({ text })),
    },
  });
}

describe("questionSets", () => {
  it("shows the first questions and keeps the rest and the ones beyond the findings for later", () => {
    const sets = questionSets(briefingWith(6, ["What does success look like?"]));
    expect(sets.first.map((question) => question.text)).toEqual(["Why C1?", "Why C2?", "Why C3?", "Why C4?"]);
    expect(sets.first).toHaveLength(QUESTIONS_SHOWN_FIRST);
    expect(sets.more.map((question) => question.text)).toEqual(["Why C5?", "Why C6?"]);
    expect(sets.beyond).toEqual(["What does success look like?"]);
    expect(sets.hiddenCount).toBe(3);
  });

  it("has nothing hidden when every question fits", () => {
    expect(questionSets(briefingWith(2, [])).hiddenCount).toBe(0);
  });
});
