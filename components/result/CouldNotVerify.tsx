import { developmentDate } from "@/lib/client/briefingView";
import { formatDayMonth } from "@/lib/client/dates";
import type { Subject, VerifiedClaim } from "@/lib/types";
import { Icon } from "../Icon";

export function CouldNotVerify({ claims, subjects, onOpen }: { claims: readonly VerifiedClaim[]; subjects: ReadonlyMap<string, Subject>; onOpen: (claimId: string) => void }) {
  if (claims.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="could-not-verify" className="mt-6 rounded-card border-2 border-dashed border-line-strong p-5 break-inside-avoid">
      <h3 id="could-not-verify" className="flex items-center gap-2 font-bold text-ink">
        <Icon name="question" className="h-5 w-5 text-unconfirmed" />
        Could not verify
      </h3>
      <ul className="mt-3 space-y-3">
        {claims.map((claim) => {
          const date = developmentDate(claim);
          const names = claim.subjectIds.flatMap((id) => subjects.get(id)?.name ?? []).join(", ");
          return (
            <li key={claim.id} className="text-muted">
              <span>{[date === null ? null : formatDayMonth(date), names].filter((part) => part !== null).join(" · ")} · </span>
              <button type="button" id={`open-${claim.id}`} onClick={() => onOpen(claim.id)} className="text-left font-semibold text-ink underline">
                {claim.text}
              </button>
              <span> We could not check this against the page cited, so it is left out of the summary.</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
