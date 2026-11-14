// Reads Bifrost's response bodies. Pure parsing only: the call itself stays in lib/model/llm.ts.
import { z } from "zod";
import type { ModelRouting } from "@/lib/types";

const UNKNOWN_ROUTING: ModelRouting = { provider: "unknown", model: "unknown", isFallback: null };

export const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  extra_fields: z.unknown().optional(),
});

const routingInfoSchema = z.object({
  routing_info: z.object({ provider: z.string(), model: z.string(), is_fallback: z.boolean().optional() }),
});

const retryHintSchema = z.object({ extra_fields: z.object({ retry_after_ms: z.number().positive() }) });

// A missing or unexpected extra_fields means "unknown", never an error.
export function readRouting(extraFields: unknown): ModelRouting {
  const parsed = routingInfoSchema.safeParse(extraFields);
  if (!parsed.success) {
    return UNKNOWN_ROUTING;
  }
  const { provider, model, is_fallback: isFallback } = parsed.data.routing_info;
  return { provider, model, isFallback: isFallback ?? null };
}

// Bifrost's error type is a fixed code such as virtual_key_required or access_blocked. Only a
// short lowercase code is accepted, so nothing else from the body can reach the server log.
const errorTypeSchema = z.object({ type: z.string().regex(/^[a-z_]{1,40}$/) });

export function readErrorType(body: unknown): string | null {
  const parsed = errorTypeSchema.safeParse(body);
  return parsed.success ? parsed.data.type : null;
}

const errorMessageSchema = z.union([
  z.object({ error: z.object({ message: z.string() }) }),
  z.object({ message: z.string() }),
]);

// Long token-like runs and anything shaped like an API key, which provider errors sometimes quote.
const KEY_LIKE = /\b(?:sk|gsk|tvly|xai|pk|rk)[-_][A-Za-z0-9_-]{6,}|\b[A-Za-z0-9_-]{32,}\b/g;
const MAX_LOGGED_MESSAGE = 200;

// Bifrost's error message for the server log, trimmed, with anything key-like masked.
export function readErrorMessage(body: unknown): string | null {
  const parsed = errorMessageSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  const message = "error" in parsed.data ? parsed.data.error.message : parsed.data.message;
  return message.replace(KEY_LIKE, "[hidden]").replace(/\s+/g, " ").trim().slice(0, MAX_LOGGED_MESSAGE);
}

// Bifrost records the provider's wait hint as extra_fields.retry_after_ms on a 429 body, when there is one.
export function readRetryHint(body: unknown): number | null {
  const parsed = retryHintSchema.safeParse(body);
  return parsed.success ? parsed.data.extra_fields.retry_after_ms : null;
}
