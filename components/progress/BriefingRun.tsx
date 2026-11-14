"use client";

import { useRouter } from "next/navigation";
import { briefingSearchParams } from "@/lib/client/briefingLink";
import type { BriefingInput } from "@/lib/types";
import { Icon } from "../Icon";
import { SiteHeader } from "../SiteHeader";
import { useFreshKey } from "../useFreshKey";
import { BriefingView } from "../result/BriefingView";
import { ResultActions } from "../result/ResultActions";
import { SaveStatus, useSavedBriefing } from "../result/useSavedBriefing";
import { ProgressView } from "./ProgressView";
import { RunError } from "./RunError";
import { useBriefingStream } from "./useBriefingStream";

export function BriefingRun({ input }: { input: BriefingInput }) {
  const key = useFreshKey(briefingSearchParams(input).toString());
  return <Run key={key} input={input} />;
}

function Run({ input }: { input: BriefingInput }) {
  const router = useRouter();
  const { run, restart, cancel, updateBriefing } = useBriefingStream(input);
  const saveState = useSavedBriefing(run.phase === "result" ? run.briefing : null);
  const onCancel = () => {
    cancel();
    router.push("/");
  };
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6">
      <SiteHeader>
        {run.phase === "running" ? (
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-ground">
            <Icon name="close" className="h-4 w-4" />
            Cancel
          </button>
        ) : run.phase === "result" ? (
          <>
            <SaveStatus state={saveState} />
            <ResultActions />
          </>
        ) : null}
      </SiteHeader>
      {run.phase === "running" ? <ProgressView input={input} progress={run.progress} startedAt={run.startedAt} window={run.window} /> : null}
      {run.phase === "result" ? <BriefingView briefing={run.briefing} onUpdate={updateBriefing} /> : null}
      {run.phase === "error" || run.phase === "rejected" ? (
        <RunError
          message={run.message}
          rateLimited={run.phase === "rejected"}
          retryAfterSeconds={run.phase === "rejected" ? run.retryAfterSeconds : null}
          input={input}
          onRetry={restart}
        />
      ) : null}
    </div>
  );
}
