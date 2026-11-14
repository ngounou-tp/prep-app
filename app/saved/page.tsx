import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedBriefingPage } from "@/components/saved/SavedBriefingPage";

export const metadata: Metadata = { title: "Saved briefing · Foreword" };

// The briefing lives in this browser, so the page reads it on the client.
export default function SavedPage() {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-[1120px] px-4 py-10 text-muted sm:px-6">Opening your saved briefing…</p>}>
      <SavedBriefingPage />
    </Suspense>
  );
}
