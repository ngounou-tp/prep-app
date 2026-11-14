"use client";

import { useState } from "react";
import { mergeRetry } from "@/lib/client/mergeRetry";
import { streamBriefing, type StreamOutcome } from "@/lib/client/streamBriefing";
import type { BriefingResult } from "@/lib/types";

export type RetryState = { phase: "running" } | { phase: "error"; message: string };

function failureMessage(outcome: Exclude<StreamOutcome, { kind: "result" }>, name: string): string {
  if (outcome.kind === "rejected" && outcome.retryAfterSeconds !== null) {
    return `Too many briefings from this connection. Try ${name} again in about ${Math.ceil(outcome.retryAfterSeconds / 60)} minutes.`;
  }
  return `We still could not finish ${name}. Please try again in a minute.`;
}

export function useSubjectRetry(briefing: BriefingResult, update: (change: (current: BriefingResult) => BriefingResult) => void) {
  const [states, setStates] = useState<Record<string, RetryState>>({});
  const setState = (subjectId: string, state: RetryState | null) =>
    setStates((current) => {
      const next = { ...current };
      if (state === null) {
        delete next[subjectId];
      } else {
        next[subjectId] = state;
      }
      return next;
    });

  const retry = (subjectId: string) => {
    const subject = briefing.input.subjects.find((candidate) => candidate.id === subjectId);
    if (subject === undefined || states[subjectId]?.phase === "running") {
      return;
    }
    setState(subjectId, { phase: "running" });
    void streamBriefing({ ...briefing.input, subjects: [subject] }, () => undefined).then((outcome) => {
      if (outcome.kind === "result") {
        update((current) => mergeRetry(current, outcome.briefing, subjectId));
        setState(subjectId, null);
      } else if (outcome.kind !== "cancelled") {
        setState(subjectId, { phase: "error", message: failureMessage(outcome, subject.name) });
      }
    });
  };
  return { states, retry };
}
