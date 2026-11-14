import type { StatusCounts } from "@/lib/types";
import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";

const COUNTERS: { key: keyof StatusCounts; label: string; icon: IconName; tone: string }[] = [
  { key: "verified", label: "Verified", icon: "checkCircle", tone: "bg-verified-surface text-verified" },
  { key: "singleSource", label: "Single source", icon: "link", tone: "bg-single-surface text-single" },
  { key: "unconfirmed", label: "Could not verify", icon: "question", tone: "bg-unconfirmed-surface text-unconfirmed" },
];

export function Counters({ counts }: { counts: StatusCounts }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3" aria-label="Claims by status">
      {COUNTERS.map((counter) => (
        <li key={counter.key}>
          <Card className="flex items-center gap-4 p-5">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${counter.tone}`}>
              <Icon name={counter.icon} />
            </span>
            <span>
              <span className="block font-heading text-[32px] leading-none font-semibold text-ink">{counts[counter.key]}</span>
              <span className="mt-1 block text-muted">{counter.label}</span>
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
