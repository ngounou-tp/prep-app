"use client";

import { useState, useSyncExternalStore } from "react";
import { safeHref } from "@/lib/client/briefingView";
import { formatDayMonth } from "@/lib/client/dates";
import type { Source } from "@/lib/types";

const WIDE = "(min-width: 1024px)";

// Environments without matchMedia (some test runners, very old browsers) count as wide.
function wideQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(WIDE) : null;
}

function subscribeToWidth(onChange: () => void): () => void {
  const query = wideQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

// A source title links to its page only for http and https, opening in a new tab without
// passing on this page. Any other address is shown as text.
function SourceItem({ source }: { source: Source }) {
  const href = safeHref(source.url);
  return (
    <li id={`source-${source.id}`} className="flex scroll-mt-6 gap-3 border-b border-line py-3 last:border-b-0">
      <span className="w-9 shrink-0 font-bold text-ink">{source.id}</span>
      <span className="min-w-0 text-sm text-muted">
        {href === null ? (
          <span className="font-semibold text-ink">{source.title}</span>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline">
            {source.title}
          </a>
        )}
        {` · ${source.domain}`}
        {source.publishedDate === null ? "" : ` · ${formatDayMonth(source.publishedDate)}`}
      </span>
    </li>
  );
}

export function SourcesSection({ sources }: { sources: readonly Source[] }) {
  const wide = useSyncExternalStore(subscribeToWidth, () => wideQuery()?.matches ?? true, () => true);
  const [chosen, setChosen] = useState<boolean | null>(null);
  if (sources.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="sources-title" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <details open={chosen ?? wide} onToggle={(event) => setChosen(event.currentTarget.open)}>
        <summary className="cursor-pointer rounded-tile py-2">
          <h2 id="sources-title" className="inline font-heading text-xl font-semibold text-ink">
            Sources
          </h2>
          <span className="ml-2 text-sm text-muted">{sources.length}</span>
        </summary>
        <ol className="mt-2 grid gap-x-8 lg:grid-cols-2">
          {sources.map((source) => (
            <SourceItem key={source.id} source={source} />
          ))}
        </ol>
      </details>
    </section>
  );
}
