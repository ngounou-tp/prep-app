import type { SubjectProgress } from "@/lib/client/progressState";
import { describeSubject } from "@/lib/client/subjectList";
import type { Subject } from "@/lib/types";
import { Avatar } from "../Avatar";
import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";

type Pill = { label: string; icon: IconName; tone: string; bar: string; percent: number };

function pillFor(progress: SubjectProgress): Pill {
  switch (progress.stage) {
    case "searching":
      return { label: "Checking", icon: "search", tone: "bg-blush text-accent-text", bar: "bg-primary", percent: 15 };
    case "reading":
      return { label: "Checking", icon: "search", tone: "bg-blush text-accent-text", bar: "bg-primary", percent: 55 };
    case "retrying":
      return { label: "Retrying", icon: "refresh", tone: "bg-single-surface text-single", bar: "bg-sun", percent: 55 };
    case "done":
    case "nothing-found":
      return { label: "Done", icon: "checkCircle", tone: "bg-verified-surface text-verified", bar: "bg-verified", percent: 100 };
    case "not-finished":
      return { label: "Not finished", icon: "clock", tone: "bg-unconfirmed-surface text-unconfirmed", bar: "bg-line-strong", percent: 100 };
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function activity(progress: SubjectProgress, claimsKnown: boolean): string {
  const sources = progress.sourceCount ?? 0;
  switch (progress.stage) {
    case "searching":
      return "searching";
    case "reading":
      return sources === 0 ? "no sources found" : `${plural(sources, "source")} · checking claims`;
    case "retrying":
      return `model busy, trying again in ${progress.retryWaitSeconds ?? 0} s`;
    case "done":
      return claimsKnown ? `${plural(progress.claimsKept, "claim")} kept` : `${plural(sources, "source")} read`;
    case "nothing-found":
      return "nothing in these 30 days";
    case "not-finished":
      return progress.failure === "not-completed" ? "ran out of time, nothing shown" : progress.failure === "rate-limit" ? "model busy, not finished" : "could not check the sources";
  }
}

function SubjectRow({ subject, progress, claimsKnown }: { subject: Subject; progress: SubjectProgress; claimsKnown: boolean }) {
  const pill = pillFor(progress);
  return (
    <li className="flex gap-4 border-t border-line py-4 first:border-t-0">
      <Avatar subject={subject} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-ink">{subject.name}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${pill.tone}`}>
            <Icon name={pill.icon} className="h-4 w-4" />
            {pill.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{`${describeSubject(subject)} · ${activity(progress, claimsKnown)}`}</p>
        <div
          role="progressbar"
          aria-label={`Progress for ${subject.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pill.percent}
          className="mt-3 h-2 overflow-hidden rounded-full bg-ground"
        >
          <div className={`h-full rounded-full transition-[width] duration-500 ${pill.bar}`} style={{ width: `${pill.percent}%` }} />
        </div>
      </div>
    </li>
  );
}

export function SubjectProgressList({ subjects, progress, claimsKnown }: { subjects: readonly Subject[]; progress: readonly SubjectProgress[]; claimsKnown: boolean }) {
  return (
    <Card aria-labelledby="reading-about" className="p-5 sm:p-6">
      <h2 id="reading-about" className="border-b border-line pb-3 font-heading text-2xl font-semibold text-ink">
        Who we are reading about
      </h2>
      <ul>
        {subjects.map((subject) => {
          const row = progress.find((candidate) => candidate.subjectId === subject.id);
          return row === undefined ? null : <SubjectRow key={subject.id} subject={subject} progress={row} claimsKnown={claimsKnown} />;
        })}
      </ul>
    </Card>
  );
}
