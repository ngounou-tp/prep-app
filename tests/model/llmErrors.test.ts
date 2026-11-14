import { afterEach, describe, expect, it, vi } from "vitest";
import { errorFor } from "@/lib/model/llmErrors";

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorFor", () => {
  it("tells the gateway refusing Foreword's key apart from a model or provider that cannot be used", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await errorFor(reply(401, { type: "virtual_key_required" }), false, "/v1/chat/completions")).kind).toBe("unauthorized");
    expect((await errorFor(reply(401, { type: "access_not_found" }), true, "/v1/chat/completions")).kind).toBe("unauthorized");
    expect((await errorFor(reply(403, { type: "model_blocked" }), true, "/v1/chat/completions")).kind).toBe("model-unavailable");
    expect((await errorFor(reply(401, { error: { type: "invalid_request_error", message: "Invalid API Key" } }), true, "/v1/chat/completions")).kind).toBe("provider-unavailable");
    expect((await errorFor(reply(403, { error: { message: "Permission denied for this model" } }), true, "/v1/chat/completions")).kind).toBe("model-unavailable");
  });

  it("treats a quota of zero as a model the plan does not include, and any other 429 as a rate limit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noQuota = await errorFor(reply(429, { error: { message: "Quota exceeded for metric: generate_content, limit: 0, model: gemini-2.5-pro" } }), true, "/v1/chat/completions");
    expect(noQuota.kind).toBe("model-unavailable");
    const busy = await errorFor(reply(429, { error: { message: "Rate limit reached, limit: 30 per minute" }, extra_fields: { retry_after_ms: 2000 } }), true, "/v1/chat/completions");
    expect(busy).toMatchObject({ kind: "rate-limit", retryAfterMilliseconds: 2000 });
  });

  it("never writes a key from the provider's message to the log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await errorFor(reply(401, { error: { message: "Invalid API Key gsk_abcdefghijklmnop1234" } }), true, "/v1/chat/completions");
    expect(logged.mock.calls.flat().join(" ")).not.toContain("gsk_abcdefghijklmnop1234");
  });
});
