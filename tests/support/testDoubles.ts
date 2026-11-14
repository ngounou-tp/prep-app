// Test support only. Names are invented and every URL uses the reserved .example or .test
// domains, so no fixture describes a real organisation, person or page.
import { vi } from "vitest";
import { z } from "zod";
import type { Environment } from "@/lib/config/env";
import type { Subject } from "@/lib/types";
import { researchWindow } from "@/lib/research/window";

// 12 Oct to 11 Nov 2026 inclusive: startDate "2026-10-12", endDate "2026-11-12".
export const TEST_WINDOW = researchWindow("2026-11-19T10:00:00Z", new Date("2026-11-11T08:00:00Z"));

export const TEST_ENVIRONMENT: Environment = {
  TAVILY_API_KEY: "test-key-not-real",
  BIFROST_URL: "http://bifrost.test",
  BIFROST_MODEL: "test-provider/test-model",
  BIFROST_API_KEY: undefined,
  BIFROST_FALLBACK_MODELS: [],
  LLM_CONCURRENCY: 1,
  LLM_PAUSE_MS: 0,
  MAX_SOURCES_PER_SUBJECT: 8,
  SOURCE_CHARS: 800,
};

export const TEST_ENVIRONMENT_SOURCE = {
  TAVILY_API_KEY: TEST_ENVIRONMENT.TAVILY_API_KEY,
  BIFROST_URL: TEST_ENVIRONMENT.BIFROST_URL,
  BIFROST_MODEL: TEST_ENVIRONMENT.BIFROST_MODEL,
  LLM_PAUSE_MS: "0",
};

const tavilyRequestSchema = z.object({
  query: z.string(),
  topic: z.enum(["news", "general"]),
  search_depth: z.string(),
  max_results: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  include_published_date: z.boolean(),
  exact_match: z.boolean(),
});

const chatRequestSchema = z.object({
  model: z.string(),
  temperature: z.number(),
  messages: z.tuple([
    z.object({ role: z.literal("system"), content: z.string() }),
    z.object({ role: z.literal("user"), content: z.string() }),
  ]),
  fallbacks: z.array(z.string()).optional(),
});

type TavilyRequest = z.infer<typeof tavilyRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
type Respond<Request> = (request: Request) => Response | Promise<Response>;

export function makeSubject(
  id: string,
  name: string,
  type: Subject["type"],
  extra: { company?: string; context?: string } = {},
): Subject {
  return { id, name, type, company: extra.company, context: extra.context };
}

export function tavilyResult(
  url: string,
  overrides: { title?: string; content?: string; score?: number; published_date?: string | null } = {},
) {
  return { title: "Example headline", url, content: "Example content.", score: 0.5, published_date: "2026-11-01", ...overrides };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function completion(content: string, extraFields?: unknown): Response {
  return jsonResponse({ choices: [{ message: { role: "assistant", content } }], extra_fields: extraFields });
}

function bodyOf(init: RequestInit | undefined): unknown {
  const body: unknown = JSON.parse(String(init?.body));
  return body;
}

const CHAT_URL = `${TEST_ENVIRONMENT.BIFROST_URL}/v1/chat/completions`;
const MODELS_URL = `${TEST_ENVIRONMENT.BIFROST_URL}/v1/models`;

type NetworkHandlers = { tavily?: Respond<TavilyRequest>; bifrost?: Respond<ChatRequest>; models?: () => Response };

// Routes Tavily, Bifrost chat and Bifrost's model list to separate fakes; any other URL is a test bug.
export function stubNetwork(handlers: NetworkHandlers) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://api.tavily.com/") && handlers.tavily !== undefined) {
      return handlers.tavily(tavilyRequestSchema.parse(bodyOf(init)));
    }
    if (url === MODELS_URL && handlers.models !== undefined) {
      return handlers.models();
    }
    if (url === CHAT_URL && handlers.bifrost !== undefined) {
      return handlers.bifrost(chatRequestSchema.parse(bodyOf(init)));
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function stubTavily(respond: Respond<TavilyRequest>) {
  return stubNetwork({ tavily: respond });
}

export function stubBifrost(respond: Respond<ChatRequest>, models?: () => Response) {
  return stubNetwork({ bifrost: respond, models });
}

type FetchMock = ReturnType<typeof stubNetwork>;

export function requestsSent(fetchMock: FetchMock): TavilyRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).startsWith("https://api.tavily.com/"))
    .map(([, init]) => tavilyRequestSchema.parse(bodyOf(init)));
}

export function chatRequestsSent(fetchMock: FetchMock): ChatRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input) === CHAT_URL)
    .map(([, init]) => chatRequestSchema.parse(bodyOf(init)));
}

// Resolves at once and records the wait, so tests check pacing and rate-limit waits without sleeping.
export function recordingPause() {
  const waits: number[] = [];
  const pause = (milliseconds: number) => {
    waits.push(milliseconds);
    return Promise.resolve();
  };
  return { pause, waits };
}
