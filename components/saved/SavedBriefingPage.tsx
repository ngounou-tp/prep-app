"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { briefingSearchParams } from "@/lib/client/briefingLink";
import { formatMeetingTime } from "@/lib/client/dates";
import { getSaved, putSaved, savedBriefingsAvailable, type SavedBriefing as StoredBriefing } from "@/lib/client/savedBriefings";
import type { BriefingResult } from "@/lib/types";
import { Card } from "../Card";
import { SiteHeader } from "../SiteHeader";
import { BriefingView } from "../result/BriefingView";
import { ResultActions } from "../result/ResultActions";
import { useFreshKey } from "../useFreshKey";

type Loaded = { phase: "loading" } | { phase: "missing" } | { phase: "ready"; saved: StoredBriefing };

function Missing() {
  return (
    <main className="pb-16">
      <Card aria-labelledby="missing-title" className="mx-auto max-w-[620px] p-6 sm:p-10">
        <h1 id="missing-title" className="font-heading text-[30px] font-semibold text-ink">
          This briefing is not on this device
        </h1>
        <p className="mt-3 text-muted">Saved briefings stay in the browser where they were made. Prepare a new one to see it here.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-6 font-bold text-on-primary shadow-card">
          New briefing
        </Link>
      </Card>
    </main>
  );
}

// A briefing reopened from this device: no new research unless the user runs it again.
export function SavedBriefingPage() {
  const id = useSearchParams().get("id");
  const key = useFreshKey(id ?? "");
  return <SavedBriefing key={key} id={id} />;
}

function SavedBriefing({ id }: { id: string | null }) {
  const [loaded, setLoaded] = useState<Loaded>({ phase: "loading" });
  useEffect(() => {
    const lookup = id === null || !savedBriefingsAvailable() ? Promise.resolve(null) : getSaved(id);
    lookup.then(
      (saved) => setLoaded(saved === null ? { phase: "missing" } : { phase: "ready", saved }),
      () => setLoaded({ phase: "missing" }),
    );
  }, [id]);

  const update = (change: (current: BriefingResult) => BriefingResult) => {
    if (loaded.phase !== "ready") {
      return;
    }
    const saved = { ...loaded.saved, briefing: change(loaded.saved.briefing), savedAt: new Date().toISOString() };
    setLoaded({ phase: "ready", saved });
    void putSaved(saved);
  };

  const rerun = loaded.phase === "ready" ? `/briefing?${briefingSearchParams(loaded.saved.briefing.input)}` : "/";
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
      <SiteHeader>
        {loaded.phase === "ready" ? (
          <>
            <Link href={rerun} className="flex h-11 items-center rounded-full px-3 font-semibold text-accent-text hover:bg-surface">
              Run it again
            </Link>
            <ResultActions shareHref={rerun} />
          </>
        ) : null}
      </SiteHeader>
      {loaded.phase === "loading" ? <p className="py-10 text-muted">Opening your saved briefing…</p> : null}
      {loaded.phase === "missing" ? <Missing /> : null}
      {loaded.phase === "ready" ? (
        <>
          <p className="mb-4 rounded-chip bg-ground text-sm text-muted print:hidden">
            Saved on this device. Prepared for {formatMeetingTime(loaded.saved.briefing.input.meetingAt)}; run it again for the latest news.
          </p>
          <BriefingView briefing={loaded.saved.briefing} onUpdate={update} />
        </>
      ) : null}
    </div>
  );
}
