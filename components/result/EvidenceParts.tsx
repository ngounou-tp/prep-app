import { categoryLabel, developmentDate, safeHref } from "@/lib/client/briefingView";
import { formatDayMonth, formatFullDate } from "@/lib/client/dates";
import { failedCheck, passedChecks, sourceExcerpt } from "@/lib/client/evidence";
import type { Source, Subject, VerifiedClaim } from "@/lib/types";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { StatusBadge } from "../StatusBadge";

export function EvidenceChips({ claim, subjects }: { claim: VerifiedClaim; subjects: ReadonlyMap<string, Subject> }) {
  const date = developmentDate(claim);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <StatusBadge status={claim.status} />
      {claim.subjectIds.flatMap((id) => {
        const subject = subjects.get(id);
        return subject === undefined
          ? []
          : [
              <span key={id} className="inline-flex items-center gap-2 rounded-full border border-line bg-ground py-1 pr-3 pl-1 text-sm font-semibold text-ink">
                <Avatar subject={subject} size="sm" />
                {subject.name}
              </span>,
            ];
      })}
      <span className="rounded-full border border-line bg-ground px-3 py-1 text-sm font-semibold text-ink">
        {categoryLabel(claim.category)}
        {date === null ? "" : ` · ${formatDayMonth(date)}`}
      </span>
    </div>
  );
}

export function CheckSummary({ claim }: { claim: VerifiedClaim }) {
  const failed = failedCheck(claim);
  if (failed !== null) {
    return (
      <section aria-labelledby="why-not-verified" className="mt-6 rounded-card bg-unconfirmed-surface p-5">
        <h3 id="why-not-verified" className="font-bold text-unconfirmed">
          Why we could not verify this
        </h3>
        <p className="mt-2 flex items-start gap-2 text-ink">
          <Icon name="question" className="mt-0.5 h-5 w-5 text-unconfirmed" />
          {failed}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="how-checked" className="mt-6 rounded-card bg-verified-surface p-5">
      <h3 id="how-checked" className="font-bold text-verified">
        How we checked this
      </h3>
      <ul className="mt-2 space-y-2">
        {passedChecks(claim).map((check) => (
          <li key={check} className="flex items-start gap-2 text-ink">
            <Icon name="checkCircle" className="mt-0.5 h-5 w-5 text-verified" />
            {check}
          </li>
        ))}
      </ul>
    </section>
  );
}

// One cited source: the sentence around the quote, with the quote marked, all as plain text.
export function EvidenceSource({ source, quote }: { source: Source; quote: string }) {
  const excerpt = sourceExcerpt(source, quote);
  const href = safeHref(source.url);
  return (
    <article className="rounded-card border border-line p-5">
      <div className="flex gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile bg-ground font-bold text-accent-text">
          {source.domain.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h4 className="font-bold text-ink">{source.title}</h4>
          <p className="text-sm text-muted">
            {[source.id, source.domain, source.publishedDate === null ? "undated" : formatFullDate(source.publishedDate)].join(" · ")}
          </p>
        </div>
      </div>
      <blockquote className="mt-4 rounded-r-tile border-l-4 border-sun bg-ground p-4 leading-relaxed text-ink">
        {excerpt.before}
        {excerpt.match === "" ? null : <mark className="rounded bg-single-surface px-0.5 text-ink">{excerpt.match}</mark>}
        {excerpt.after}
      </blockquote>
      {href === null ? null : (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-11 items-center gap-2 font-semibold text-accent-text">
          <Icon name="externalLink" className="h-4 w-4" />
          Open the source
          <span className="sr-only"> ({source.title}, opens in a new tab)</span>
        </a>
      )}
    </article>
  );
}
