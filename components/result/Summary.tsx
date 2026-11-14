"use client";

import { useState } from "react";
import { matchesFilter, type SubjectFilter } from "@/lib/client/briefingView";
import { questionSets } from "@/lib/client/questions";
import type { BriefingResult, Subject } from "@/lib/types";
import { Card } from "../Card";
import { Icon } from "../Icon";

export function InShort({ briefing, subjects }: { briefing: BriefingResult; subjects: ReadonlyMap<string, Subject> }) {
  const lines = briefing.subjects.filter((section) => section.line !== null);
  return (
    <Card aria-labelledby="in-short" className="p-5">
      <h2 id="in-short" className="font-heading text-xl font-semibold text-ink">
        In short
      </h2>
      <p className="mt-3 leading-relaxed text-muted">
        {briefing.snapshot ?? "The summary could not be written this time. The developments below were checked as usual."}
      </p>
      {lines.length === 0 ? null : (
        <ul className="mt-3 space-y-2">
          {lines.map((section) => (
            <li key={section.subjectId} className="text-sm leading-relaxed text-muted">
              <strong className="text-ink">{subjects.get(section.subjectId)?.name}.</strong> {section.line}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type Question = BriefingResult["questions"][number];

function QuestionItem({ question, number, subjects, filter }: { question: Question; number: number; subjects: ReadonlyMap<string, Subject>; filter: SubjectFilter }) {
  return (
    <li hidden={!matchesFilter(question.subjectIds, filter)} className="flex gap-3">
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-sun text-sm font-bold text-sun">
        {number}
      </span>
      <span>
        <span className="block leading-snug">{question.text}</span>
        <span className="mt-1 block text-sm font-bold text-sun">{question.subjectIds.map((id) => subjects.get(id)?.name ?? "").join(", ")}</span>
      </span>
    </li>
  );
}

function BeyondTheFindings({ questions }: { questions: readonly string[] }) {
  if (questions.length === 0) {
    return null;
  }
  return (
    <div className="mt-5 border-t border-on-questions/20 pt-4">
      <h3 className="font-bold">Beyond the findings</h3>
      <p className="mt-1 text-sm text-on-questions/80">Not tied to a source: what is worth learning in any meeting like this one.</p>
      <ul className="mt-3 space-y-3">
        {questions.map((question) => (
          <li key={question} className="flex gap-3 leading-snug">
            <Icon name="chat" className="mt-0.5 h-4 w-4 shrink-0 text-sun" />
            {question}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AskInTheRoom({ briefing, subjects, filter }: { briefing: BriefingResult; subjects: ReadonlyMap<string, Subject>; filter: SubjectFilter }) {
  const [expanded, setExpanded] = useState(false);
  const sets = questionSets(briefing);
  if (sets.first.length === 0 && sets.beyond.length === 0) {
    return null;
  }
  const listed = expanded ? [...sets.first, ...sets.more] : sets.first;
  return (
    <section aria-labelledby="ask-in-the-room" className="on-plum rounded-card bg-questions p-5 text-on-questions shadow-card break-inside-avoid">
      <h2 id="ask-in-the-room" className="flex items-center gap-2 font-heading text-xl font-semibold">
        <Icon name="chat" className="h-5 w-5" />
        Ask in the room
      </h2>
      <ol className="mt-4 space-y-4">
        {listed.map((question, index) => (
          <QuestionItem key={`${question.claimId}-${index}`} question={question} number={index + 1} subjects={subjects} filter={filter} />
        ))}
      </ol>
      {expanded ? <BeyondTheFindings questions={sets.beyond} /> : null}
      {sets.hiddenCount === 0 ? null : (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sun px-4 text-sm font-bold text-sun hover:bg-on-questions/10"
        >
          <Icon name={expanded ? "close" : "plus"} className="h-4 w-4" />
          {expanded ? "Fewer questions" : `Want more questions? ${sets.hiddenCount} more`}
        </button>
      )}
    </section>
  );
}
