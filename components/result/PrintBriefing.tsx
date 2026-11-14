"use client";

import { missingSubjects, subjectsById } from "@/lib/client/briefingView";
import { formatDayMonth, formatMeetingTime } from "@/lib/client/dates";
import { meetingTypeLabel } from "@/lib/client/meetingForm";
import { questionSets } from "@/lib/client/questions";
import type { BriefingResult } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";
import { PrintDevelopments, PrintHeading, PrintQuestions, PrintSources, shownGroups, subjectLabel } from "./PrintSections";
import { usePrintFit } from "./usePrintFit";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="rounded-[4pt] border border-line px-[5pt] py-[1.5pt]">
      <strong className="text-ink">{value}</strong> {label}
    </span>
  );
}

function PrintHeader({ briefing }: { briefing: BriefingResult }) {
  const { verified, singleSource } = briefing.counts;
  return (
    <header className="border-b-[2pt] border-primary pb-[5pt]">
      <div className="flex items-baseline justify-between gap-[8pt] text-[8pt] text-muted">
        <p>
          <span className="font-heading text-[11pt] font-semibold text-accent-text">Foreword</span> · Pre-meeting briefing
        </p>
        <p>Prepared {formatMeetingTime(briefing.generatedAt)}</p>
      </div>
      <h1 className="mt-[2pt] font-heading text-[17pt] leading-tight font-semibold text-ink">
        {meetingTypeLabel(briefing.input)} · {formatMeetingTime(briefing.input.meetingAt)}
      </h1>
      <ul className="mt-[4pt] flex flex-wrap gap-[3pt] text-[8.5pt]">
        {briefing.input.subjects.map((subject) => (
          <li key={subject.id} className="rounded-full bg-ground px-[6pt] py-[1pt] font-semibold text-ink">
            {subjectLabel(subject)}
          </li>
        ))}
      </ul>
      <p className="mt-[4pt] flex flex-wrap gap-[4pt] text-[8pt] text-muted">
        <Figure value={`${formatDayMonth(briefing.window.startDate)} to ${formatDayMonth(briefing.window.lastDate)}`} label="read" />
        <Figure value={briefing.research.sourcesFound} label={briefing.research.sourcesFound === 1 ? "source" : "sources"} />
        <Figure value={verified} label="verified" />
        <Figure value={singleSource} label="single source" />
      </p>
    </header>
  );
}

function Legend({ citedCount }: { citedCount: number }) {
  return (
    <footer className="mt-[6pt] flex flex-wrap items-center gap-x-[6pt] gap-y-[2pt] border-t border-line pt-[3pt] text-[7pt] text-muted">
      <StatusBadge status="verified" size="print" /> quote found in a cited source, reported by two or more sites
      <StatusBadge status="single-source" size="print" /> one source only
      <span>Every claim was checked against its source by code, not by the model. {plural(citedCount, "source")} cited above.</span>
    </footer>
  );
}

// The downloadable one-page report: only what is needed in the meeting. It replaces the screen
// layout when printing or saving as PDF and always covers everyone, whatever the screen filter.
export function PrintBriefing({ briefing }: { briefing: BriefingResult }) {
  const subjects = subjectsById(briefing);
  const groups = shownGroups(briefing);
  const cited = new Set(groups.flatMap((group) => group.rows.flatMap((claim) => claim.sourceIds)));
  const missingIds = missingSubjects(briefing).map(({ subjectId }) => subjectId);
  const missing = missingIds.map((id) => subjects.get(id)?.name ?? id);
  const quiet = briefing.input.subjects.filter((subject) => !missingIds.includes(subject.id) && !groups.some((group) => group.subjectId === subject.id));
  const printedSources = briefing.sources.filter((source) => cited.has(source.id));
  const fit = usePrintFit();
  return (
    <article ref={fit} data-testid="print-briefing" data-print-report="" className="hidden text-[9.5pt] leading-[1.35] text-ink print:block">
      <PrintHeader briefing={briefing} />
      {missing.length === 0 ? null : <p className="mt-[4pt] rounded-[4pt] bg-single-surface px-[6pt] py-[2pt] text-[8.5pt] text-single">Not finished: {missing.join(", ")}. Run it again before the meeting.</p>}
      {quiet.length === 0 ? null : <p className="mt-[4pt] text-[8.5pt] text-muted">Nothing found in the 30 days for {quiet.map(subjectLabel).join(", ")}.</p>}
      <section className="mt-[7pt] rounded-[6pt] border-l-[3pt] border-primary bg-ground px-[7pt] py-[5pt]">
        <h2 className="font-heading text-[11pt] font-semibold text-ink">In short</h2>
        <p className="mt-[2pt] text-ink">{briefing.snapshot ?? "The summary could not be written; the developments below were checked as usual."}</p>
      </section>
      <PrintHeading>What changed</PrintHeading>
      <PrintDevelopments groups={groups} subjects={subjects} />
      <PrintQuestions sets={questionSets(briefing)} subjects={subjects} />
      <PrintHeading>Sources</PrintHeading>
      <PrintSources sources={printedSources} />
      <Legend citedCount={printedSources.length} />
    </article>
  );
}
