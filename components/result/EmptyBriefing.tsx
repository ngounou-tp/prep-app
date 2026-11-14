import Link from "next/link";
import { briefingSearchParams } from "@/lib/client/briefingLink";
import { namesList } from "@/lib/client/briefingView";
import { formatDayMonth } from "@/lib/client/dates";
import type { BriefingResult } from "@/lib/types";
import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";

const SUGGESTIONS: { icon: IconName; title: string; text: string }[] = [
  { icon: "pencil", title: "Check the spelling", text: "Or add the website so we find the right one." },
  { icon: "calendar", title: "Widen the context", text: "Add a person who works there, or their company or city." },
];

export function EmptyBriefing({ briefing }: { briefing: BriefingResult }) {
  const names = namesList(briefing.input.subjects.map((subject) => subject.name));
  const { searchesRun, sourcesFound } = briefing.research;
  return (
    <main className="pb-16">
      <Card aria-labelledby="empty-title" className="mx-auto max-w-[780px] p-6 text-center sm:p-10">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ground text-accent-text ring-8 ring-ground/60">
          <Icon name="search" className="h-8 w-8" />
        </span>
        <h1 id="empty-title" className="mt-6 font-heading text-[30px] leading-tight font-semibold text-ink sm:text-[40px]">
          Nothing significant between {formatDayMonth(briefing.window.startDate)} and {formatDayMonth(briefing.window.lastDate)}
        </h1>
        <p className="mx-auto mt-4 max-w-[540px] leading-relaxed text-muted">
          We ran {searchesRun} {searchesRun === 1 ? "search" : "searches"} about <strong className="text-ink">{names}</strong> and read {sourcesFound}{" "}
          {sourcesFound === 1 ? "page" : "pages"}. None reported a development we could confirm, so there is nothing to brief you on. That is a useful
          answer too.
        </p>
        <ul className="mt-8 grid gap-4 text-left sm:grid-cols-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion.title} className="flex gap-3 rounded-card bg-ground p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-tile bg-surface text-accent-text">
                <Icon name={suggestion.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">{suggestion.title}</span>
                <span className="block text-muted">{suggestion.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-semibold text-ink hover:bg-ground">
            Start over
          </Link>
          <Link
            href={`/?${briefingSearchParams(briefing.input)}`}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-on-primary shadow-card"
          >
            Edit and try again
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </main>
  );
}
