"use client";

import { useEffect, useRef, useState } from "react";
import { applyProgress, initialProgress, type ProgressState } from "@/lib/client/progressState";
import { streamBriefing, type StreamOutcome } from "@/lib/client/streamBriefing";
import { researchWindow } from "@/lib/research/window";
import type { BriefingInput, BriefingResult, ResearchWindow } from "@/lib/types";

export type RunState =
  | { phase: "running"; progress: ProgressState; startedAt: number | null; window: ResearchWindow | null }
  | { phase: "result"; briefing: BriefingResult }
  | { phase: "error"; message: string }
  | { phase: "rejected"; message: string; retryAfterSeconds: number | null };

function settled(outcome: StreamOutcome): RunState | null {
  switch (outcome.kind) {
    case "result":
      return { phase: "result", briefing: outcome.briefing };
    case "error":
      return { phase: "error", message: outcome.message };
    case "rejected":
      return outcome.status === 429
        ? { phase: "rejected", message: outcome.message, retryAfterSeconds: outcome.retryAfterSeconds }
        : { phase: "error", message: outcome.message };
    case "cancelled":
      return null;
  }
}

function freshRun(input: BriefingInput, startedAt: number | null): RunState {
  return { phase: "running", progress: initialProgress(input), startedAt, window: startedAt === null ? null : researchWindow(input.meetingAt, new Date(startedAt)) };
}

// One request per run: the caller keys this per request, so `input` is fixed for its lifetime.
// The request starts a tick after the effect, so React's development double-mount does not send
// it twice (each one costs credits). A page left while running is hidden, not unmounted: its
// request is cancelled, and on return it starts over from a clean progress screen. A finished
// run is never requested again; Back shows the same result.
export function useBriefingStream(requested: BriefingInput) {
  const [input] = useState(requested);
  const [run, setRun] = useState<RunState>(() => freshRun(input, null));
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (settledRef.current) {
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => {
      setRun(freshRun(input, Date.now()));
      const onEvent = (line: Parameters<Parameters<typeof streamBriefing>[1]>[0]) => {
        if (line.type !== "result" && line.type !== "error") {
          setRun((current) => (current.phase === "running" ? { ...current, progress: applyProgress(current.progress, line) } : current));
        }
      };
      void streamBriefing(input, onEvent, { signal: controller.signal }).then((outcome) => {
        const next = settled(outcome);
        if (next !== null) {
          settledRef.current = true;
          setRun(next);
        }
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, attempt]);

  const restart = () => {
    settledRef.current = false;
    setRun(freshRun(input, null));
    setAttempt((value) => value + 1);
  };
  const cancel = () => controllerRef.current?.abort();
  // Applied to the latest briefing, so two retries finishing close together both land.
  const updateBriefing = (change: (current: BriefingResult) => BriefingResult) =>
    setRun((current) => (current.phase === "result" ? { phase: "result", briefing: change(current.briefing) } : current));
  return { run, restart, cancel, updateBriefing };
}
