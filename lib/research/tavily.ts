// The only module that calls the Tavily Search API.
import "server-only";
import { z } from "zod";
import { createLimiter } from "@/lib/shared/concurrency";
import type { Environment } from "@/lib/config/env";
import { planSearches } from "@/lib/research/queries";
import { mergeSources } from "@/lib/research/sources";
import type { Query, ResearchResult, ResearchWindow, SearchHit, Subject } from "@/lib/types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MILLISECONDS = 12_000;
const MAX_RESULTS_PER_SEARCH = 8;
const MAX_SEARCHES_PER_BRIEFING = 12;
const MAX_REQUESTS_IN_FLIGHT = 6;

const tavilyResponseSchema = z.object({ results: z.array(z.unknown()) });

const tavilyResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  score: z.number(),
  published_date: z.string().nullish(),
});

type TavilyResult = z.infer<typeof tavilyResultSchema>;

type TavilyErrorKind = "http" | "timeout" | "network" | "malformed" | "cancelled";

export class TavilyError extends Error {
  readonly kind: TavilyErrorKind;
  readonly status: number | null;

  constructor(kind: TavilyErrorKind, status: number | null = null, options?: ErrorOptions) {
    super(status === null ? `Tavily search failed: ${kind}` : `Tavily search failed with status ${status}`, options);
    this.name = "TavilyError";
    this.kind = kind;
    this.status = status;
  }
}

// `cancel` is the briefing's own signal (time budget or client disconnect); the timeout is per request.
async function postSearch(body: Record<string, unknown>, apiKey: string, cancel?: AbortSignal): Promise<unknown> {
  if (cancel?.aborted) {
    throw new TavilyError("cancelled");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: cancel === undefined ? controller.signal : AbortSignal.any([controller.signal, cancel]),
    });
    if (response.status !== 200) {
      throw new TavilyError("http", response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof TavilyError) {
      throw error;
    }
    throw new TavilyError(failureKind(error, controller.signal, cancel), null, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function failureKind(error: unknown, timeout: AbortSignal, cancel: AbortSignal | undefined): TavilyErrorKind {
  if (cancel?.aborted) {
    return "cancelled";
  }
  return timeout.aborted ? "timeout" : error instanceof SyntaxError ? "malformed" : "network";
}

// A malformed envelope fails the search; a malformed item is dropped and the rest are kept.
function parseResults(json: unknown): TavilyResult[] {
  const envelope = tavilyResponseSchema.safeParse(json);
  if (!envelope.success) {
    throw new TavilyError("malformed");
  }
  return envelope.data.results.flatMap((item) => {
    const result = tavilyResultSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

export async function search(
  query: Query,
  window: ResearchWindow,
  exactMatch: boolean,
  apiKey: string,
  cancel?: AbortSignal,
): Promise<TavilyResult[]> {
  const json = await postSearch(
    {
      query: query.text,
      topic: query.topic,
      search_depth: "basic",
      max_results: MAX_RESULTS_PER_SEARCH,
      start_date: window.startDate,
      end_date: window.endDate,
      include_published_date: true,
      exact_match: exactMatch,
    },
    apiKey,
    cancel,
  );
  return parseResults(json);
}

// Retries share what is left of the per-briefing search cap, so they never exceed it.
// `sent` counts searches that actually went out, for "We ran 5 searches".
type SearchTally = { retriesLeft: number; sent: number };

async function searchWithRetry(
  query: Query,
  window: ResearchWindow,
  apiKey: string,
  tally: SearchTally,
  cancel?: AbortSignal,
): Promise<TavilyResult[]> {
  const send = (exactMatch: boolean) => {
    if (!cancel?.aborted) {
      tally.sent += 1;
    }
    return search(query, window, exactMatch, apiKey, cancel);
  };
  const exactResults = await send(true);
  if (exactResults.length > 0 || tally.retriesLeft <= 0) {
    return exactResults;
  }
  tally.retriesLeft -= 1;
  return send(false);
}

function toSearchHit(result: TavilyResult, subjectId: string): SearchHit {
  return {
    subjectId,
    title: result.title,
    url: result.url,
    content: result.content,
    score: result.score,
    publishedDate: result.published_date ?? null,
  };
}

export async function researchAll(
  subjects: readonly Subject[],
  window: ResearchWindow,
  environment: Environment,
  cancel?: AbortSignal,
): Promise<ResearchResult> {
  const apiKey = environment.TAVILY_API_KEY;
  const planned = planSearches(subjects);
  const tally: SearchTally = { retriesLeft: Math.max(0, MAX_SEARCHES_PER_BRIEFING - planned.length), sent: 0 };
  const limit = createLimiter(MAX_REQUESTS_IN_FLIGHT);
  const outcomes = await Promise.allSettled(
    planned.map(({ query }) => limit(() => searchWithRetry(query, window, apiKey, tally, cancel))),
  );

  const hits: SearchHit[] = [];
  const answeredSubjectIds = new Set<string>();
  const cutOffSubjectIds = new Set<string>();
  outcomes.forEach((outcome, index) => {
    const { subjectId } = planned[index];
    if (outcome.status === "fulfilled") {
      answeredSubjectIds.add(subjectId);
      hits.push(...outcome.value.map((result) => toSearchHit(result, subjectId)));
    } else if (outcome.reason instanceof TavilyError && outcome.reason.kind === "cancelled") {
      cutOffSubjectIds.add(subjectId);
    }
  });

  const unanswered = subjects.filter((subject) => !answeredSubjectIds.has(subject.id)).map((subject) => subject.id);
  return {
    sources: mergeSources(hits, window, {
      perSubject: environment.MAX_SOURCES_PER_SUBJECT,
      contentCharacters: environment.SOURCE_CHARS,
    }),
    failedSubjectIds: unanswered.filter((subjectId) => !cutOffSubjectIds.has(subjectId)),
    unfinishedSubjectIds: unanswered.filter((subjectId) => cutOffSubjectIds.has(subjectId)),
    searchesRun: tally.sent,
  };
}
