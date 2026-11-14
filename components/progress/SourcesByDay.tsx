import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatDayMonth } from "@/lib/client/dates";
import type { ResearchWindow } from "@/lib/types";
import { Card } from "../Card";

export function SourcesByDay({ window, counts }: { window: ResearchWindow | null; counts: ReadonlyMap<string, number> }) {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return (
    <Card aria-labelledby="sources-by-day" className="p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="sources-by-day" className="font-heading text-2xl font-semibold text-ink">
          Sources by day
        </h2>
        <span className="text-muted">{total} found</span>
      </div>
      {window === null ? null : <Bars window={window} counts={counts} total={total} />}
    </Card>
  );
}

function Bars({ window, counts, total }: { window: ResearchWindow; counts: ReadonlyMap<string, number>; total: number }) {
  const lastDate = format(window.end, "yyyy-MM-dd");
  const days = Math.max(1, differenceInCalendarDays(parseISO(lastDate), parseISO(window.startDate)));
  const dates = Array.from({ length: days + 1 }, (_, index) => format(addDays(parseISO(window.startDate), index), "yyyy-MM-dd"));
  const highest = Math.max(1, ...counts.values());
  const newest = [...dates].reverse().find((date) => (counts.get(date) ?? 0) > 0);
  return (
    <>
      <p className="sr-only">{`${total} dated sources across ${[...counts.keys()].length} days.`}</p>
      <div aria-hidden="true" className="mt-6 flex h-24 items-end gap-[2px] border-b-2 border-line-strong">
        {dates.map((date) => {
          const count = counts.get(date) ?? 0;
          return (
            <span key={date} className="flex h-full flex-1 items-end justify-center">
              {count === 0 ? null : (
                <span
                  className={`w-full max-w-2 rounded-t-full ${date === newest ? "bg-primary" : "bg-sun"}`}
                  style={{ height: `${Math.max(18, (count / highest) * 100)}%` }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-sm font-semibold text-muted">
        <span>{formatDayMonth(window.startDate)}</span>
        <span>{formatDayMonth(dates[Math.floor(dates.length / 2)])}</span>
        <span>{formatDayMonth(lastDate)}</span>
      </div>
    </>
  );
}
