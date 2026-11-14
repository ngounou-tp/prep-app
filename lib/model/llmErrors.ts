// Bifrost failures as typed errors, each logged once on the server with its cause: status,
// endpoint, Bifrost's error code and a trimmed, key-masked message. Never the key, prompt or URL.
import { readErrorMessage, readErrorType, readRetryHint } from "@/lib/model/bifrostResponse";

// model-unavailable and provider-unavailable: Bifrost accepted the key, but this model, or every
// model of this provider, cannot be used, so "auto" can move on to another.
type LlmErrorKind =
  | "http"
  | "unauthorized"
  | "model-unavailable"
  | "provider-unavailable"
  | "rate-limit"
  | "timeout"
  | "network"
  | "malformed"
  | "cancelled"
  | "no-models";

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

// A quota of zero means the account's plan does not include the model; waiting will not help.
const NO_QUOTA = /\blimit:\s*0\b/i;

// Bifrost's own access errors carry a top-level type; errors relayed from a provider do not.
function accessError(status: number, keySent: boolean, body: unknown): LlmError {
  if (readErrorType(body) === "model_blocked") {
    console.error(`Bifrost does not allow this model for the virtual key (status ${status})`);
    return new LlmError("model-unavailable", status);
  }
  const fromGateway = typeof body === "object" && body !== null && "type" in body;
  if (!fromGateway) {
    console.error(`The provider refused the request (status ${status}): ${readErrorMessage(body) ?? "no message"}`);
    return new LlmError(status === 401 ? "provider-unavailable" : "model-unavailable", status);
  }
  console.error(accessMessage(status, keySent, body));
  return new LlmError("unauthorized", status);
}

export async function errorFor(response: Response, keySent: boolean, path: string): Promise<LlmError> {
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    return accessError(response.status, keySent, body);
  }
  if (response.status === 429) {
    if (NO_QUOTA.test(readErrorMessage(body) ?? "")) {
      console.error("The provider gives this account no quota for the model");
      return new LlmError("model-unavailable", 429);
    }
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
