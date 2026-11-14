// Browser helper for POST /api/briefing. Imports only the shared schemas, never a server module.
import { apiErrorSchema, streamLineSchema, type BriefingInput, type BriefingResult, type StreamLine } from "@/lib/types";

const ENDPOINT = "/api/briefing";
const CONNECTION_LOST = "The connection was lost before the briefing finished. Please try again.";

type FieldProblem = { path: string; message: string };

export type StreamOutcome =
  | { kind: "result"; briefing: BriefingResult }
  | { kind: "error"; message: string }
  | { kind: "rejected"; status: number; message: string; fields: FieldProblem[]; retryAfterSeconds: number | null }
  | { kind: "cancelled" };

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    // stream: true keeps a multi-byte character split across chunks intact.
    buffered += decoder.decode(chunk.value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    yield* lines.filter((line) => line.trim() !== "");
  }
  if (buffered.trim() !== "") {
    yield buffered;
  }
}

// A line that is not valid JSON or does not match the schema is skipped rather than shown.
function parseLine(line: string): StreamLine | null {
  try {
    const json: unknown = JSON.parse(line);
    const parsed = streamLineSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function rejected(response: Response): Promise<StreamOutcome> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  const retryAfter = Number(response.headers.get("Retry-After"));
  return {
    kind: "rejected",
    status: response.status,
    message: parsed.success ? parsed.data.error : "The request was not accepted. Please try again.",
    fields: parsed.success ? (parsed.data.fields ?? []) : [],
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  };
}

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (line: StreamLine) => void): Promise<StreamOutcome> {
  let outcome: StreamOutcome = { kind: "error", message: CONNECTION_LOST };
  for await (const line of readLines(body)) {
    const event = parseLine(line);
    if (event === null) {
      continue;
    }
    onEvent(event);
    if (event.type === "result") {
      outcome = { kind: "result", briefing: event.briefing };
    } else if (event.type === "error") {
      outcome = { kind: "error", message: event.message };
    }
  }
  return outcome;
}

export async function streamBriefing(
  input: BriefingInput,
  onEvent: (line: StreamLine) => void,
  options: { signal?: AbortSignal } = {},
): Promise<StreamOutcome> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: options.signal,
    });
    if (!response.ok || response.body === null) {
      return await rejected(response);
    }
    return await readStream(response.body, onEvent);
  } catch (error) {
    if (options.signal?.aborted) {
      return { kind: "cancelled" };
    }
    if (error instanceof TypeError) {
      return { kind: "error", message: CONNECTION_LOST };
    }
    throw error;
  }
}
