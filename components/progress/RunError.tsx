import Link from "next/link";
import { briefingSearchParams } from "@/lib/client/briefingLink";
import type { BriefingInput } from "@/lib/types";
import { Card } from "../Card";
import { Icon } from "../Icon";

type RunErrorProps = {
  message: string;
  retryAfterSeconds: number | null;
  rateLimited: boolean;
  input: BriefingInput;
  onRetry: () => void;
};

function whatToDo(rateLimited: boolean, retryAfterSeconds: number | null): string {
  if (rateLimited) {
    const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
    return `You can try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}. Fewer people or companies use up less of the limit.`;
  }
  return "Wait a minute and try again. If it keeps happening, try with fewer people or companies.";
}

export function RunError({ message, retryAfterSeconds, rateLimited, input, onRetry }: RunErrorProps) {
  return (
    <main className="pb-16">
      <Card aria-labelledby="run-error-title" className="mx-auto max-w-[680px] p-6 sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-single-surface text-single">
          <Icon name="warning" />
        </span>
        <h1 id="run-error-title" className="mt-4 font-heading text-[30px] leading-tight font-semibold text-ink">
          {rateLimited ? "Too many briefings for now" : "We could not prepare this briefing"}
        </h1>
        <p role="alert" className="mt-3 text-ink">
          {message}
        </p>
        <p className="mt-2 text-muted">{whatToDo(rateLimited, retryAfterSeconds)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onRetry} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-on-primary shadow-card">
            <Icon name="refresh" className="h-4 w-4" />
            Try again
          </button>
          <Link href={`/?${briefingSearchParams(input)}`} className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-semibold text-ink hover:bg-ground">
            Change the meeting
          </Link>
        </div>
      </Card>
    </main>
  );
}
