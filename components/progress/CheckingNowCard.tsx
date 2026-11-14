import { formatDayMonth } from "@/lib/client/dates";
import type { ProgressEvent } from "@/lib/types";
import { Icon } from "../Icon";
import { StatusBadge } from "../StatusBadge";

type CheckingEvent = Extract<ProgressEvent, { type: "checking" }>;

// Only the checks this claim passed, as reported by the server's verification.
function passedChecks(check: CheckingEvent): string[] {
  const { quoteSourceId, quoteDomain, publishedDate, secondSourceId } = check.checks;
  const lines: string[] = [];
  if (quoteSourceId !== null) {
    lines.push(`Quote found in ${quoteSourceId}${quoteDomain === null ? "" : `, ${quoteDomain}`}`);
  }
  if (publishedDate !== null && check.claim.status !== "unconfirmed") {
    lines.push(`Published ${formatDayMonth(publishedDate)}, inside the 30 days`);
  }
  if (secondSourceId !== null && check.claim.status === "verified") {
    lines.push(`Confirmed by a second site, ${secondSourceId}`);
  }
  return lines;
}

export function CheckingNowCard({ check }: { check: CheckingEvent | null }) {
  return (
    <section aria-labelledby="checking-now" className="on-plum rounded-card bg-questions p-6 text-on-questions shadow-card">
      <h2 id="checking-now" className="flex items-center gap-2 text-sm font-bold tracking-widest text-sun uppercase">
        <Icon name="search" className="h-4 w-4" />
        Checking now
      </h2>
      <div aria-live="polite" aria-atomic="true">
        {check === null ? (
          <p className="mt-4 text-on-questions">Each claim appears here while we check it against its source.</p>
        ) : (
          <>
            <p className="mt-4 font-heading text-2xl leading-snug font-semibold">“{check.claim.text}”</p>
            <ul className="mt-4 space-y-2">
              {passedChecks(check).map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Icon name="checkCircle" className="mt-0.5 h-5 w-5 text-verified-surface" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <StatusBadge status={check.claim.status} size="lg" />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
