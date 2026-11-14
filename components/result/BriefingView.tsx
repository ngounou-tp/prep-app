"use client";

import { useState } from "react";
import { isEmptyBriefing, missingSubjects, subjectsById, visibleDevelopmentIds, type SubjectFilter } from "@/lib/client/briefingView";
import type { BriefingResult } from "@/lib/types";
import { Counters } from "./Counters";
import { DevelopmentsColumn } from "./DevelopmentsColumn";
import { EmptyBriefing } from "./EmptyBriefing";
import { EvidencePanel } from "./EvidencePanel";
import { FilterChips } from "./FilterChips";
import { MeetingCard } from "./MeetingCard";
import { PartialBanner } from "./PartialBanner";
import { PrintBriefing } from "./PrintBriefing";
import { SourcesSection } from "./SourcesSection";
import { AskInTheRoom, InShort } from "./Summary";
import { TimelineCard } from "./TimelineCard";
import { useClaimHash } from "./useClaimHash";
import { useSubjectRetry } from "./useSubjectRetry";

type BriefingViewProps = { briefing: BriefingResult; onUpdate: (change: (current: BriefingResult) => BriefingResult) => void };

function toggled(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}

// The finished briefing. The subject filter, "more found" and the evidence panel all work on
// the result already in the page: none of them sends a new request.
export function BriefingView({ briefing, onUpdate }: BriefingViewProps) {
  const [filter, setFilter] = useState<SubjectFilter>("everyone");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const hash = useClaimHash();
  const retry = useSubjectRetry(briefing, onUpdate);
  if (isEmptyBriefing(briefing)) {
    return <EmptyBriefing briefing={briefing} />;
  }
  const subjects = subjectsById(briefing);
  const missing = missingSubjects(briefing).flatMap(({ subjectId, note }) => {
    const subject = subjects.get(subjectId);
    return subject === undefined ? [] : [{ subject, note }];
  });
  const openClaim = briefing.claims.find((claim) => claim.id === hash.openId) ?? null;
  const order = visibleDevelopmentIds(briefing, filter, expanded);
  const position = openClaim === null ? -1 : order.indexOf(openClaim.id);
  const step = (offset: number) => (position === -1 || order[position + offset] === undefined ? null : () => hash.open(order[position + offset]));
  return (
    <>
      <main inert={openClaim !== null} className="space-y-5 pb-16 print:hidden">
        {missing.length === 0 ? null : <PartialBanner missing={missing} total={subjects.size} retries={retry.states} onRetry={retry.retry} />}
        <MeetingCard briefing={briefing} fadedIds={missing.map(({ subject }) => subject.id)} />
        <FilterChips subjects={briefing.input.subjects} filter={filter} onChange={setFilter} />
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <div className="space-y-5 lg:col-start-2 lg:row-start-3">
            <InShort briefing={briefing} subjects={subjects} />
            <AskInTheRoom briefing={briefing} subjects={subjects} filter={filter} />
          </div>
          <div className="lg:col-span-2 lg:row-start-2">
            <TimelineCard briefing={briefing} subjects={subjects} filter={filter} expanded={expanded} />
          </div>
          <div className="lg:col-span-2 lg:row-start-1">
            <Counters counts={briefing.counts} />
          </div>
          <div className="lg:col-start-1 lg:row-start-3">
            <DevelopmentsColumn
              briefing={briefing}
              subjects={subjects}
              filter={filter}
              expanded={expanded}
              retries={retry.states}
              onToggleMore={(subjectId) => setExpanded((current) => toggled(current, subjectId))}
              onOpen={hash.open}
              onRetry={retry.retry}
            />
          </div>
        </div>
        <SourcesSection sources={briefing.sources} />
      </main>
      <PrintBriefing briefing={briefing} />
      {openClaim === null ? null : <EvidencePanel claim={openClaim} subjects={subjects} onClose={hash.close} onPrevious={step(-1)} onNext={step(1)} />}
    </>
  );
}
