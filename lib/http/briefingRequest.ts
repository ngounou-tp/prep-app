// Handles POST /api/briefing: checks the request, applies the rate limit, then streams the
// briefing as newline-delimited JSON. Messages sent to the client are fixed, generic strings;
// details go to the server log only.
import "server-only";
import { everySubjectFailed } from "@/lib/briefing/assemble";
import type { createBriefing } from "@/lib/briefing/briefing";
import type { RateLimiter } from "@/lib/http/rateLimit";
import { fieldMessage } from "@/lib/shared/fieldMessages";
import { briefingInputSchema, type ApiError, type BriefingInput, type StreamLine } from "@/lib/types";

const MAX_BODY_BYTES = 8 * 1024;
const GENERIC_ERROR = "We could not prepare this briefing. Please try again in a minute.";
const ALL_SUBJECTS_FAILED = "We could not research any of these people or companies. Please try again in a minute.";

export type BriefingRequestDependencies = {
  limiter: RateLimiter;
  createBriefing: typeof createBriefing;
  now: () => Date;
};

function jsonError(status: number, body: ApiError, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function isJson(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.split(";")[0].trim().toLowerCase() === "application/json";
}

// Counts the bytes actually received, so a missing or false Content-Length cannot get past the cap.
async function readBodyWithin(request: Request, maxBytes: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return null;
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseJsonText(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

// The first address in x-forwarded-for is the client as seen by the nearest proxy.
function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function streamBriefing(request: Request, input: BriefingInput, dependencies: BriefingRequestDependencies): Response {
  const stop = new AbortController();
  const onDisconnect = () => stop.abort();
  request.signal.addEventListener("abort", onDisconnect, { once: true });
  const encoder = new TextEncoder();
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: StreamLine) => {
        if (!open) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        const briefing = await dependencies.createBriefing(input, dependencies.now(), { signal: stop.signal, onProgress: send });
        if (everySubjectFailed(briefing)) {
          console.error(`Briefing failed for every subject: ${briefing.subjects.map((section) => section.note?.kind).join(", ")}`);
          send({ type: "error", message: ALL_SUBJECTS_FAILED });
        } else {
          send({ type: "result", briefing });
        }
      } catch (error) {
        console.error(`Briefing failed: ${error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"}`);
        send({ type: "error", message: GENERIC_ERROR });
      } finally {
        request.signal.removeEventListener("abort", onDisconnect);
        if (open) {
          open = false;
          controller.close();
        }
      }
    },
    cancel() {
      open = false;
      stop.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function handleBriefingRequest(request: Request, dependencies: BriefingRequestDependencies): Promise<Response> {
  if (!isJson(request)) {
    return jsonError(415, { error: "Send the briefing request as JSON." });
  }
  const text = await readBodyWithin(request, MAX_BODY_BYTES);
  if (text === null) {
    return jsonError(413, { error: "This request is too large." });
  }
  const json = parseJsonText(text);
  if (!json.ok) {
    return jsonError(400, { error: "The request is not valid JSON." });
  }
  const input = briefingInputSchema.safeParse(json.value);
  if (!input.success) {
    const fields = input.error.issues.map((issue) => ({ path: issue.path.join("."), message: fieldMessage(issue) }));
    return jsonError(400, { error: "Some fields need attention.", fields });
  }
  const decision = dependencies.limiter.take(clientAddress(request), input.data.subjects.length, dependencies.now().getTime());
  if (!decision.allowed) {
    const retryAfter = { "Retry-After": String(decision.retryAfterSeconds) };
    return jsonError(429, { error: "Too many briefings from this connection. Try again later." }, retryAfter);
  }
  return streamBriefing(request, input.data, dependencies);
}
