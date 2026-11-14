import { alsoAbout, developmentDate, developmentsFor, matchesFilter, type SubjectFilter } from "@/lib/client/briefingView";
import { describeSubject } from "@/lib/client/subjectList";
import type { BriefingResult, Subject } from "@/lib/types";
import { Avatar } from "../Avatar";
import { DevelopmentCard } from "./DevelopmentCard";
import { SubjectStateCard } from "./SubjectStateCard";
import type { RetryState } from "./useSubjectRetry";

export type GroupProps = {
  briefing: BriefingResult;
  subject: Subject;
  subjects: ReadonlyMap<string, Subject>;
  nested: boolean;
  filter: SubjectFilter;
  expanded: boolean;
  retry: RetryState | undefined;
  onToggleMore: (subjectId: string) => void;
  onOpen: (claimId: string) => void;
  onRetry: (subjectId: string) => void;
};

function countLine(subject: Subject, developments: number): string {
  return developments === 0 ? describeSubject(subject) : `${describeSubject(subject)} · ${developments} ${developments === 1 ? "development" : "developments"}`;
}

export function SubjectGroup(props: GroupProps) {
  const { briefing, subject, subjects, nested, filter, expanded, retry, onToggleMore, onOpen, onRetry } = props;
  const section = briefing.subjects.find((candidate) => candidate.subjectId === subject.id);
  const developments = developmentsFor(briefing, subject.id, expanded);
  const visible = filter === "everyone" || filter === subject.id || developments.some(({ claim }) => matchesFilter(claim.subjectIds, filter));
  const moreCount = section?.moreCount ?? 0;
  return (
    <section aria-labelledby={`subject-${subject.id}`} hidden={!visible} className={nested ? "pl-4 sm:pl-8" : ""}>
      <div className="mb-3 flex items-center gap-3">
        <Avatar subject={subject} size="md" />
        <div>
          <h3 id={`subject-${subject.id}`} className="font-heading text-[22px] leading-tight font-semibold text-ink">
            {subject.name}
          </h3>
          <p className="text-sm text-muted">{countLine(subject, developments.filter(({ extra }) => !extra).length + moreCount)}</p>
        </div>
      </div>
      <div className="space-y-3">
        {developments.map(({ claim }) => (
          <DevelopmentCard
            key={claim.id}
            claim={claim}
            date={developmentDate(claim)}
            alsoAbout={alsoAbout(claim, subject.id, subjects)}
            visible={matchesFilter(claim.subjectIds, filter)}
            onOpen={onOpen}
          />
        ))}
        {section?.note === null || section === undefined ? null : (
          <SubjectStateCard subject={subject} note={section.note} subjectCount={briefing.input.subjects.length} retry={retry} onRetry={onRetry} />
        )}
        {moreCount === 0 ? null : (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggleMore(subject.id)}
            data-print="hide"
            className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-ground"
          >
            {expanded ? "Show fewer" : `${moreCount} more found`}
          </button>
        )}
      </div>
    </section>
  );
}
