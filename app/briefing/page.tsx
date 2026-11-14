import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { BriefingRun } from "@/components/progress/BriefingRun";
import { readBriefingSearchParams } from "@/lib/client/briefingLink";

export const metadata: Metadata = { title: "Your briefing · Foreword" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The input lives in the URL so the page can be reloaded and shared; a broken link goes back
// to the form with a message.
async function BriefingFromLink({ searchParams }: { searchParams: SearchParams }) {
  const input = readBriefingSearchParams(await searchParams);
  if (input === null) {
    redirect("/?notice=invalid-link");
  }
  return <BriefingRun input={input} />;
}

function OpeningBriefing() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
      <SiteHeader />
      <p className="py-10 text-muted">Opening your briefing…</p>
    </div>
  );
}

export default function BriefingPage({ searchParams }: PageProps<"/briefing">) {
  return (
    <Suspense fallback={<OpeningBriefing />}>
      <BriefingFromLink searchParams={searchParams} />
    </Suspense>
  );
}
