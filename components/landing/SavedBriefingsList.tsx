"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMeetingTime } from "@/lib/client/dates";
import { deleteSaved, listSaved, savedBriefingsAvailable, summarize, type SavedSummary } from "@/lib/client/savedBriefings";
import { Card } from "../Card";
import { Icon } from "../Icon";

const SHOWN_AT_FIRST = 4;

function SavedRow({ summary, onDelete }: { summary: SavedSummary; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{summary.subjects}</p>
        <p className="text-sm text-muted">
          {summary.title} · {formatMeetingTime(summary.meetingAt)} · {summary.findings} {summary.findings === 1 ? "finding" : "findings"}
        </p>
      </div>
      <Link href={`/saved?id=${encodeURIComponent(summary.id)}`} className="inline-flex h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-on-primary">
        Open
      </Link>
      <button
        type="button"
        onClick={() => (confirming ? onDelete(summary.id) : setConfirming(true))}
        aria-label={confirming ? `Confirm: delete the briefing for ${summary.subjects}` : `Delete the briefing for ${summary.subjects}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-ground"
      >
        <Icon name="close" className="h-4 w-4" />
        {confirming ? "Confirm delete" : "Delete"}
      </button>
    </li>
  );
}

export function SavedBriefingsList() {
  const [saved, setSaved] = useState<SavedSummary[]>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (savedBriefingsAvailable()) {
      listSaved().then(
        (list) => setSaved(list.map(summarize)),
        () => setSaved([]),
      );
    }
  }, []);
  if (saved.length === 0) {
    return null;
  }
  const remove = (id: string) => {
    setSaved((current) => current.filter((entry) => entry.id !== id));
    void deleteSaved(id);
  };
  return (
    <Card aria-labelledby="your-briefings" className="mx-auto mt-6 max-w-220 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="your-briefings" className="font-heading text-xl font-semibold text-ink">
          Your briefings
        </h2>
        <p className="text-sm text-muted">Kept on this device only</p>
      </div>
      <ul className="mt-2">
        {(showAll ? saved : saved.slice(0, SHOWN_AT_FIRST)).map((summary) => (
          <SavedRow key={summary.id} summary={summary} onDelete={remove} />
        ))}
      </ul>
      {saved.length > SHOWN_AT_FIRST ? (
        <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll} className="mt-2 h-11 rounded-full px-3 text-sm font-semibold text-accent-text">
          {showAll ? "Show fewer" : `Show all ${saved.length}`}
        </button>
      ) : null}
    </Card>
  );
}
