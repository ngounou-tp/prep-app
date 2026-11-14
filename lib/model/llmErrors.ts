// Bifrost failures as typed errors, each logged once on the server with its cause: status,
// endpoint, Bifrost's error code and a trimmed, key-masked message. Never the key, prompt or URL.
import { readErrorMessage, readErrorType, readRetryHint } from "@/lib/model/bifrostResponse";

type LlmErrorKind = "http" | "unauthorized" | "rate-limit" | "timeout" | "network" | "malformed" | "cancelled" | "no-models";

export class LlmError extends Error {
  readonly kind: LlmErrorKind;
  readonly status: number | null;
  readonly retryAfterMilliseconds: number | null;

  constructor(kind: LlmErrorKind, status: number | null, retryAfterMilliseconds: number | null = null, options?: ErrorOptions) {
    super(status === null ? `Bifrost call failed: ${kind}` : `Bifrost call failed: ${kind} (status ${status})`, options);
    this.name = "LlmError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMilliseconds = retryAfterMilliseconds;
  }
}

function describe(status: number, body: unknown): string {
  const type = readErrorType(body);
  const message = readErrorMessage(body);
  return [type === null ? `status ${status}` : `${type}, status ${status}`, message].filter((part) => part !== null).join(": ");
}

// Says whether a key was sent at all, so the log tells "no key" apart from "key refused".
function accessMessage(status: number, keySent: boolean, body: unknown): string {
  const errorType = readErrorType(body);
  const detail = errorType === null ? `status ${status}` : `${errorType}, status ${status}`;
  return keySent
    ? `Bifrost refused BIFROST_API_KEY (${detail}). Check that the virtual key exists and is active in the Bifrost dashboard.`
    : `Bifrost requires a key: set BIFROST_API_KEY (${detail})`;
}

export async function errorFor(response: Response, keySent: boolean, path: string): Promise<LlmError> {
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    console.error(accessMessage(response.status, keySent, body));
    return new LlmError("unauthorized", response.status);
  }
  if (response.status === 429) {
    return new LlmError("rate-limit", 429, readRetryHint(body));
  }
  console.error(`Bifrost ${path} failed (${describe(response.status, body)})`);
  return new LlmError("http", response.status);
}

// Network and timeout failures, logged with the error code (ECONNREFUSED…), never the address.
export function failureFor(error: unknown, timeout: AbortSignal, cancel: AbortSignal | undefined, path: string): LlmError {
  if (cancel?.aborted) {
    return new LlmError("cancelled", null, null, { cause: error });
  }
  if (timeout.aborted) {
    console.error(`Bifrost ${path} did not answer in time`);
    return new LlmError("timeout", null, null, { cause: error });
  }
  if (error instanceof SyntaxError) {
    console.error(`Bifrost ${path} answered with something that is not JSON`);
    return new LlmError("malformed", null, null, { cause: error });
  }
  const code = error instanceof Error && error.cause instanceof Error && "code" in error.cause ? String(error.cause.code) : "unknown";
  console.error(`Could not reach Bifrost at BIFROST_URL for ${path} (${code}). Is Bifrost running?`);
  return new LlmError("network", null, null, { cause: error });
}
