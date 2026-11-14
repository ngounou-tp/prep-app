import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatDayMonth } from "@/lib/client/dates";
import type { ClaimStatus } from "@/lib/types";

export type TimelineItem = {
  id: string;
  date: string;
  status: ClaimStatus;
  href: string;
  label: string;
  // Hidden by the subject filter.
  hidden?: boolean;
};

const DOT: Record<ClaimStatus, { ring: string; fill: string }> = {
  verified: { ring: "border-verified", fill: "bg-verified" },
  "single-source": { ring: "border-single", fill: "bg-single" },
  unconfirmed: { ring: "border-unconfirmed", fill: "bg-unconfirmed" },
};

function position(date: string, startDate: string, totalDays: number): number {
  const day = differenceInCalendarDays(parseISO(date), parseISO(startDate));
  return Math.min(100, Math.max(0, (day / totalDays) * 100));
}

// The 30-day line. The track is inset by half a hit area so a dot on the first or last day
// never pokes out of the card, even at 360px.
export function Timeline({ startDate, lastDate, items }: { startDate: string; lastDate: string; items: readonly TimelineItem[] }) {
  const totalDays = Math.max(1, differenceInCalendarDays(parseISO(lastDate), parseISO(startDate)));
  const middle = format(addDays(parseISO(startDate), Math.round(totalDays / 2)), "yyyy-MM-dd");
  const sameDayIndex = new Map<string, number>();
  return (
    <div>
      <div className="relative mx-[22px] h-11">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line-strong" />
        {items.map((item) => {
          const offset = sameDayIndex.get(item.date) ?? 0;
          sameDayIndex.set(item.date, offset + 1);
          return (
            <a
              key={item.id}
              href={item.href}
              aria-label={item.label}
              hidden={item.hidden}
              className="absolute top-0 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full"
              style={{ left: `calc(${position(item.date, startDate, totalDays)}% + ${offset * 10}px)` }}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 bg-surface ${DOT[item.status].ring}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[item.status].fill}`} />
              </span>
            </a>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-sm text-muted">
        <span>{formatDayMonth(startDate)}</span>
        <span>{formatDayMonth(middle)}</span>
        <span>{formatDayMonth(lastDate)}</span>
      </div>
    </div>
  );
}
