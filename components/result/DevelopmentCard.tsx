import { categoryLabel } from "@/lib/client/briefingView";
import { dayTile } from "@/lib/client/dates";
import type { VerifiedClaim } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

type DevelopmentCardProps = {
  claim: VerifiedClaim;
  date: string | null;
  alsoAbout: readonly string[];
  visible: boolean;
  onOpen: (claimId: string) => void;
};

function DateTile({ date }: { date: string | null }) {
  if (date === null) {
    return <span className="flex h-16 w-14 shrink-0 items-center justify-center rounded-tile bg-ground text-xs font-semibold text-muted">No date</span>;
  }
  const tile = dayTile(date);
  return (
    <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-tile bg-ground">
      <span className="font-heading text-2xl leading-none font-semibold text-ink">{tile.day}</span>
      <span className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">{tile.month}</span>
    </span>
  );
}

export function DevelopmentCard({ claim, date, alsoAbout, visible, onOpen }: DevelopmentCardProps) {
  return (
    <article
      id={`development-${claim.id}`}
      hidden={!visible}
      className="flex scroll-mt-6 gap-4 rounded-card border border-line bg-surface p-4 shadow-card break-inside-avoid sm:p-5"
    >
      <DateTile date={date} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          id={`open-${claim.id}`}
          onClick={() => onOpen(claim.id)}
          className="rounded-tile text-left text-[17px] leading-snug font-semibold text-ink hover:underline"
        >
          {claim.text}
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusBadge status={claim.status} />
          <span className="text-muted">{categoryLabel(claim.category)}</span>
          {alsoAbout.length === 0 ? null : (
            <span className="rounded-full border border-line bg-ground px-3 py-1 text-sm text-muted">Also about {alsoAbout.join(", ")}</span>
          )}
          {claim.sourceIds.map((sourceId) => (
            <a key={sourceId} href={`#source-${sourceId}`} className="flex h-11 min-w-11 items-center justify-center font-semibold text-accent-text underline">
              <span className="sr-only">Source </span>
              {sourceId}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
