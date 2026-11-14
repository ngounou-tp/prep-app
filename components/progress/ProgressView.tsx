"use client";

import { useEffect, useState } from "react";
import { estimateSecondsLeft, sourcesByDay, type ProgressState } from "@/lib/client/progressState";
import { stageAnnouncement, stepSummaries } from "@/lib/client/progressSteps";
import type { BriefingInput, ResearchWindow } from "@/lib/types";
import { AvatarStack } from "../Avatar";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { CheckingNowCard } from "./CheckingNowCard";
import { SourcesByDay } from "./SourcesByDay";
import { Stepper } from "./Stepper";
import { SubjectProgressList } from "./SubjectProgressList";

// Ticks once a second so the time estimate can follow real progress. Null until the first tick:
// the server never reads the clock.
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type ProgressViewProps = { input: BriefingInput; progress: ProgressState; startedAt: number | null; window: ResearchWindow | null };

export function ProgressView({ input, progress, startedAt, window }: ProgressViewProps) {
  const now = useNow();
  const estimate = startedAt === null || now === null ? null : estimateSecondsLeft(progress, (now - startedAt) / 1000);
  return (
    <main className="space-y-6 pb-16">
      <Card aria-labelledby="progress-title" className="p-5 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <AvatarStack subjects={input.subjects} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-widest text-accent-text uppercase">Preparing your briefing</p>
            <h1 id="progress-title" className="mt-2 font-heading text-[32px] leading-tight font-semibold text-ink sm:text-[44px]">
              Reading the last 30 days for your meeting
            </h1>
          </div>
          {estimate === null ? null : (
            <p className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-ground px-4 py-2 font-semibold text-ink md:self-center">
              <Icon name="clock" className="h-5 w-5" />
              About {estimate} seconds left
            </p>
          )}
        </div>
        <div className="mt-6 border-t border-line pt-6">
          <Stepper steps={stepSummaries(progress)} />
        </div>
        <p aria-live="polite" className="sr-only">
          {stageAnnouncement(progress)}
        </p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SubjectProgressList subjects={input.subjects} progress={progress.subjects} claimsKnown={progress.totalClaims !== null} />
        <div className="space-y-6">
          <CheckingNowCard check={progress.latestCheck} />
          <SourcesByDay window={window} counts={sourcesByDay(progress)} />
        </div>
      </div>
    </main>
  );
}
