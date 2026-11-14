import { groupLayout, type SubjectFilter } from "@/lib/client/briefingView";
import type { BriefingResult, Subject } from "@/lib/types";
import { CouldNotVerify } from "./CouldNotVerify";
import { SubjectGroup } from "./SubjectGroup";
import type { RetryState } from "./useSubjectRetry";

type DevelopmentsColumnProps = {
  briefing: BriefingResult;
  subjects: ReadonlyMap<string, Subject>;
  filter: SubjectFilter;
  expanded: ReadonlySet<string>;
  retries: Record<string, RetryState>;
  onToggleMore: (subjectId: string) => void;
  onOpen: (claimId: string) => void;
  onRetry: (subjectId: string) => void;
};

export function DevelopmentsColumn({ briefing, subjects, filter, expanded, retries, onToggleMore, onOpen, onRetry }: DevelopmentsColumnProps) {
  return (
    <section aria-labelledby="what-changed">
      <h2 id="what-changed" className="mb-4 font-heading text-[28px] font-semibold text-ink">
        What changed
      </h2>
      <div className="space-y-8">
        {groupLayout(briefing).flatMap(({ subjectId, nested }) => {
          const subject = subjects.get(subjectId);
          return subject === undefined
            ? []
            : [
                <SubjectGroup
                  key={subjectId}
                  briefing={briefing}
                  subject={subject}
                  subjects={subjects}
                  nested={nested}
                  filter={filter}
                  expanded={expanded.has(subjectId)}
                  retry={retries[subjectId]}
                  onToggleMore={onToggleMore}
                  onOpen={onOpen}
                  onRetry={onRetry}
                />,
              ];
        })}
      </div>
      <CouldNotVerify claims={briefing.claims.filter((claim) => claim.status === "unconfirmed")} subjects={subjects} onOpen={onOpen} />
    </section>
  );
}
