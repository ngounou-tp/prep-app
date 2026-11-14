// The only module that calls the model, through the Bifrost gateway.
import "server-only";
import type { z } from "zod";
import type { Environment } from "@/lib/config/env";
import { completionSchema, readRouting } from "@/lib/model/bifrostResponse";
import { errorFor, failureFor, LlmError } from "@/lib/model/llmErrors";
import { createModelPicker, type ModelChoice, type ModelSettings } from "@/lib/model/modelChoice";
import { createPacedLimiter } from "@/lib/shared/concurrency";
import type { ModelRouting } from "@/lib/types";

export { LlmError } from "@/lib/model/llmErrors";

const REQUEST_TIMEOUT_MILLISECONDS = 40_000;
const MODEL_LIST_TIMEOUT_MILLISECONDS = 10_000;
// A sleeping gateway (a Railway service with sleeping on) can take a while to answer its first request.
const WAKE_TIMEOUT_MILLISECONDS = 70_000;
const DEFAULT_RATE_LIMIT_WAIT_MILLISECONDS = 5_000;
const MAX_RATE_LIMIT_WAIT_MILLISECONDS = 15_000;
// With "auto", how many models one call may try before giving up.
const MAX_MODEL_TRIES = 4;

type ChatReply = { text: string; routing: ModelRouting };
// cancel: the briefing's time budget or a client disconnect. shouldStart is asked when the
// call's turn in the queue comes, so no new call starts once the budget is nearly spent.
// onRetry is told the wait before the one rate-limit retry, so the page can say so.
type CallOptions = { cancel?: AbortSignal; shouldStart?: () => boolean; onRetry?: (waitMilliseconds: number) => void };
type ModelFailure = "rate-limit" | "invalid-output" | "unavailable" | "cancelled";
type ModelResult<Output> = { ok: true; value: Output; routing: ModelRouting } | { ok: false; failure: ModelFailure };
type AttemptResult<Output> = ModelResult<Output> | { ok: false; failure: "rate-limit"; waitMilliseconds: number };
type JsonParseResult = { ok: true; value: unknown } | { ok: false };
type Connection = { baseUrl: string; apiKey: string | undefined };

// Takes the outermost {...}, so code fences or prose around the object do not matter.
export function parseJson(text: string): JsonParseResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false };
  }
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

async function requestJson(connection: Connection, path: string, init: RequestInit, timeoutMilliseconds: number, cancel?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  const headers: Record<string, string> = init.body === undefined ? {} : { "Content-Type": "application/json" };
  if (connection.apiKey !== undefined) {
    headers["x-bf-vk"] = connection.apiKey;
  }
  try {
    const signal = cancel === undefined ? controller.signal : AbortSignal.any([controller.signal, cancel]);
    const response = await fetch(`${connection.baseUrl}${path}`, { ...init, headers, signal });
    if (response.status !== 200) {
      throw await errorFor(response, connection.apiKey !== undefined, path);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof LlmError) {
      throw error;
    }
    throw failureFor(error, controller.signal, cancel, path);
  } finally {
    clearTimeout(timer);
  }
}

async function sendChat(connection: Connection, choice: ModelChoice, system: string, user: string, cancel?: AbortSignal): Promise<ChatReply> {
  const body = {
    model: choice.model,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(choice.fallbacks.length > 0 ? { fallbacks: choice.fallbacks } : {}),
  };
  const json = await requestJson(connection, "/v1/chat/completions", { method: "POST", body: JSON.stringify(body) }, REQUEST_TIMEOUT_MILLISECONDS, cancel);
  const completion = completionSchema.safeParse(json);
  if (!completion.success) {
    throw new LlmError("malformed", 200);
  }
  return { text: completion.data.choices[0].message.content, routing: readRouting(completion.data.extra_fields) };
}

function toAttemptFailure(error: LlmError): AttemptResult<never> {
  if (error.kind === "rate-limit") {
    const hinted = error.retryAfterMilliseconds ?? DEFAULT_RATE_LIMIT_WAIT_MILLISECONDS;
    return { ok: false, failure: "rate-limit", waitMilliseconds: Math.min(hinted, MAX_RATE_LIMIT_WAIT_MILLISECONDS) };
  }
  if (error.kind === "cancelled") {
    return { ok: false, failure: "cancelled" };
  }
  return { ok: false, failure: error.kind === "malformed" ? "invalid-output" : "unavailable" };
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createModelClient(environment: Environment, pause: (milliseconds: number) => Promise<void> = sleep) {
  const connection: Connection = { baseUrl: environment.BIFROST_URL.replace(/\/+$/, ""), apiKey: environment.BIFROST_API_KEY };
  const settings: ModelSettings = { model: environment.BIFROST_MODEL, fallbacks: environment.BIFROST_FALLBACK_MODELS };
  // One picker per client (one briefing): with "auto" the model list is fetched once.
  const picker = createModelPicker(settings, () => requestJson(connection, "/v1/models", { method: "GET" }, MODEL_LIST_TIMEOUT_MILLISECONDS));
  // The queue: LLM_CONCURRENCY calls at a time, LLM_PAUSE_MS between them, for free-tier limits.
  const enqueue = createPacedLimiter(environment.LLM_CONCURRENCY, environment.LLM_PAUSE_MS, pause);

  const send = async (system: string, user: string, cancel?: AbortSignal): Promise<ChatReply> => {
    for (let tries = 1; ; tries += 1) {
      const choice = await picker.current();
      try {
        return await sendChat(connection, choice, system, user, cancel);
      } catch (error) {
        if (tries >= MAX_MODEL_TRIES || !picker.refuse(choice.model, error)) {
          throw error;
        }
      }
    }
  };

  const chat = (system: string, user: string, options: CallOptions = {}): Promise<ChatReply> =>
    enqueue(async () => {
      if (options.cancel?.aborted || options.shouldStart?.() === false) {
        throw new LlmError("cancelled", null);
      }
      return send(system, user, options.cancel);
    });

  async function attemptJson<Schema extends z.ZodType>(system: string, user: string, schema: Schema, options: CallOptions): Promise<AttemptResult<z.output<Schema>>> {
    let reply: ChatReply;
    try {
      reply = await chat(system, user, options);
    } catch (error) {
      if (error instanceof LlmError) {
        return toAttemptFailure(error);
      }
      throw error;
    }
    const parsed = parseJson(reply.text);
    const validated = parsed.ok ? schema.safeParse(parsed.value) : null;
    return validated?.success ? { ok: true, value: validated.data, routing: reply.routing } : { ok: false, failure: "invalid-output" };
  }

  // Two attempts at most. Invalid output retries at once; a rate limit waits first. Anything else stops.
  async function chatJson<Schema extends z.ZodType>(system: string, user: string, schema: Schema, options: CallOptions = {}): Promise<ModelResult<z.output<Schema>>> {
    let result = await attemptJson(system, user, schema, options);
    if (!result.ok && (result.failure === "invalid-output" || result.failure === "rate-limit")) {
      if ("waitMilliseconds" in result) {
        options.onRetry?.(result.waitMilliseconds);
        await pause(result.waitMilliseconds);
      }
      result = await attemptJson(system, user, schema, options);
    }
    if (!result.ok && result.failure === "invalid-output") {
      console.error("The model answered twice, but not with the JSON the prompt asked for");
    }
    return result.ok ? result : { ok: false, failure: result.failure };
  }

  return { chat, chatJson };
}

export type ModelClient = ReturnType<typeof createModelClient>;

// Waking the gateway while the user fills in the form keeps its start-up time out of the
// briefing's 55 seconds. /health needs no key, so none is sent.
export async function wakeGateway(environment: Environment): Promise<boolean> {
  const connection: Connection = { baseUrl: environment.BIFROST_URL.replace(/\/+$/, ""), apiKey: undefined };
  try {
    await requestJson(connection, "/health", { method: "GET" }, WAKE_TIMEOUT_MILLISECONDS);
    return true;
  } catch (error) {
    if (error instanceof LlmError) {
      return false;
    }
    throw error;
  }
}
