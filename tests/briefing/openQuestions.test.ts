import { describe, expect, it } from "vitest";
import { keepOpenQuestions, knownWords } from "@/lib/briefing/openQuestions";
import type { BriefingInput } from "@/lib/types";
import { company, fixtureClaim, person } from "@/tests/support/briefingFixture";

const input: BriefingInput = {
  meetingAt: "2026-11-19T10:00:00.000Z",
  meetingType: "other",
  meetingTopic: "Pilot in Rotterdam",
  subjects: [company("c1", "Northwind Freight"), person("p1", "Amara Diallo", "Harbor Capital")],
};
const known = knownWords(input, [fixtureClaim("C1", ["c1"], { text: "Opened a hub in Antwerp." })]);

describe("keepOpenQuestions", () => {
  it("keeps questions that use only names the briefing already has", () => {
    const questions = ["What would success look like for Northwind Freight?", "How does Amara Diallo decide at Harbor Capital?", "Who else should join the Rotterdam pilot?", "Is Antwerp part of the plan?"];
    expect(keepOpenQuestions(questions, known)).toEqual(questions);
  });

  it("drops any question with a number or a name the briefing does not contain", () => {
    expect(keepOpenQuestions(["How did the Acme deal go?", "What changed after 2025?", "Is the budget above 2 million?", "Will you meet in March?"], known)).toEqual([]);
  });

  it("allows a capital at the start of a sentence, and removes blanks and repeats", () => {
    expect(keepOpenQuestions(["  What matters most to you?", "Fine. Where could this stall?", "", "What matters most to you?"], known)).toEqual([
      "What matters most to you?",
      "Fine. Where could this stall?",
    ]);
  });
});
