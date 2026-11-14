import type { Subject, SubjectNote } from "@/lib/types";
import { Icon } from "../Icon";
import type { RetryState } from "./useSubjectRetry";

const REASONS: Record<SubjectNote["kind"], (name: string) => string> = {
  "model-rate-limit": (name) => `The model was busy while we read about ${name}.`,
  "not-completed": (name) => `We ran out of time before checking ${name}.`,
  "model-failed": (name) => `The model could not read the sources about ${name}.`,
  "research-failed": (name) => `The search for ${name} failed.`,
  "nothing-found": () => "",
};

type Missing = { subject: Subject; note: SubjectNote };

export function PartialBanner({ missing, total, retries, onRetry }: { missing: readonly Missing[]; total: number; retries: Record<string, RetryState>; onRetry: (subjectId: string) => void }) {
  const ready = total - missing.length;
  return (
    <section aria-labelledby="partial-title" className="flex flex-col gap-4 rounded-card bg-single-surface p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-single">
        <Icon name="warning" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="partial-title" className="font-bold text-ink">
          Your briefing is ready for {ready} of {total} people and companies.
        </h2>
        <p className="mt-1 text-muted">
          {missing.map(({ subject, note }) => REASONS[note.kind](subject.name)).join(" ")} Everything shown below was checked as usual.
        </p>
        <p role="status" className="mt-1 text-sm font-semibold text-single">
          {missing.flatMap(({ subject }) => {
            const state = retries[subject.id];
            return state === undefined ? [] : [state.phase === "running" ? `Checking ${subject.name} again…` : state.message];
          }).join(" ")}
        </p>
      </div>
      <div className="flex flex-col gap-2" data-print="hide">
        {missing.map(({ subject }) => (
          <button
            key={subject.id}
            type="button"
            onClick={() => onRetry(subject.id)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary shadow-card"
          >
            Finish {subject.name}
            <Icon name="refresh" className="h-4 w-4" />
          </button>
        ))}
      </div>
    </section>
  );
}
