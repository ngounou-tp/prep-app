// Questions beyond the findings carry no source, so they may not slip in a fact: any number, or
// any name the briefing does not already contain, drops the question.
import type { BriefingInput, VerifiedClaim } from "@/lib/types";

const CAPITALISED_WORD = /\p{Lu}[\p{L}'’-]*/gu;
const SENTENCE_START = /(^|[.?!:;]\s+|["“(]\s*)$/u;

export function knownWords(input: BriefingInput, claims: readonly VerifiedClaim[]): ReadonlySet<string> {
  const subjectText = input.subjects.flatMap((subject) => [subject.name, subject.company ?? "", subject.context ?? ""]);
  const text = [...subjectText, input.meetingTopic ?? "", ...claims.map((claim) => claim.text)].join(" ");
  return new Set(text.match(CAPITALISED_WORD) ?? []);
}

function inventsNothing(question: string, known: ReadonlySet<string>): boolean {
  if (/\d/u.test(question)) {
    return false;
  }
  return [...question.matchAll(CAPITALISED_WORD)].every(({ 0: word, index }) => {
    const opensSentence = SENTENCE_START.test(question.slice(0, index));
    return opensSentence || word === "I" || known.has(word);
  });
}

export function keepOpenQuestions(questions: readonly string[], known: ReadonlySet<string>): string[] {
  const kept = questions.map((question) => question.trim()).filter((question) => question !== "" && inventsNothing(question, known));
  return [...new Set(kept)];
}
