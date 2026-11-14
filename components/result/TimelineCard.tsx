import { STATUS_LABELS, categoryLabel, developmentDate, developmentsFor, matchesFilter, type SubjectFilter } from "@/lib/client/briefingView";
import { formatDayMonth } from "@/lib/client/dates";
import type { BriefingResult, Subject } from "@/lib/types";
import { Card } from "../Card";
import { Timeline, type TimelineItem } from "../Timeline";

function timelineItems(briefing: BriefingResult, subjects: ReadonlyMap<string, Subject>, filter: SubjectFilter, expanded: ReadonlySet<string>): TimelineItem[] {
  return briefing.input.subjects.flatMap((subject) =>
    developmentsFor(briefing, subject.id, expanded.has(subject.id)).flatMap(({ claim }) => {
      const date = developmentDate(claim);
      if (date === null) {
        return [];
      }
      const names = claim.subjectIds.map((id) => subjects.get(id)?.name ?? "").join(" and ");
      return [
        {
          id: claim.id,
          date,
          status: claim.status,
          href: `#development-${claim.id}`,
          label: `${formatDayMonth(date)}, ${names}, ${STATUS_LABELS[claim.status]}, ${categoryLabel(claim.category)}`,
          hidden: !matchesFilter(claim.subjectIds, filter),
        },
      ];
    }),
  );
}

export function TimelineCard(props: { briefing: BriefingResult; subjects: ReadonlyMap<string, Subject>; filter: SubjectFilter; expanded: ReadonlySet<string> }) {
  return (
    <Card aria-labelledby="last-30-days" className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="last-30-days" className="font-heading text-xl font-semibold text-ink">
          The last 30 days
        </h2>
        <p className="text-sm text-muted" data-print="hide">
          Tap a dot to jump to it
        </p>
      </div>
      <Timeline startDate={props.briefing.window.startDate} lastDate={props.briefing.window.lastDate} items={timelineItems(props.briefing, props.subjects, props.filter, props.expanded)} />
    </Card>
  );
}
