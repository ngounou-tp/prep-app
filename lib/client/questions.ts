import type { BriefingResult } from "@/lib/types";

// Enough to walk in with; the rest wait behind "More questions" so the page stays one page.
export const QUESTIONS_SHOWN_FIRST = 4;

type Question = BriefingResult["questions"][number];

export type QuestionSets = { first: Question[]; more: Question[]; beyond: string[]; hiddenCount: number };

export function questionSets(briefing: BriefingResult): QuestionSets {
  const first = briefing.questions.slice(0, QUESTIONS_SHOWN_FIRST);
  const more = briefing.questions.slice(QUESTIONS_SHOWN_FIRST);
  return { first, more, beyond: briefing.openQuestions, hiddenCount: more.length + briefing.openQuestions.length };
}
