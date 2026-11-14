import { namesList } from "@/lib/client/briefingView";
import { searchedTopics } from "@/lib/research/queries";
import type { Subject, SubjectNote } from "@/lib/types";
import { Icon } from "../Icon";
import type { RetryState } from "./useSubjectRetry";

export function SubjectStateCard(props: {
  subject: Subject;
  note: SubjectNote;
  subjectCount: number;
  retry: RetryState | undefined;
  onRetry: (subjectId: string) => void;
}) {
  const { subject, note, subjectCount, retry, onRetry } = props;
  if (note.kind === "nothing-found") {
    return (
      <div className="flex items-start gap-4 rounded-card border-2 border-dashed border-line-strong p-5 break-inside-avoid">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-unconfirmed-surface text-unconfirmed">
          <Icon name="search" />
        </span>
        <p className="text-muted">
          <strong className="text-ink">Nothing significant in these 30 days.</strong> We searched {namesList(searchedTopics(subject.type, subjectCount))} and
          found nothing to report.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-single-surface text-single">
        <Icon name="clock" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted">{note.message}</p>
        <p role="status" className="mt-1 text-sm font-semibold text-single">
          {retry === undefined ? "" : retry.phase === "running" ? `Checking ${subject.name} again…` : retry.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRetry(subject.id)}
        data-print="hide"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-bold text-ink hover:bg-ground"
      >
        <Icon name="refresh" className="h-4 w-4" />
        Try this one again
      </button>
    </div>
  );
}
