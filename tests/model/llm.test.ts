import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModelClient, LlmError, parseJson } from "@/lib/model/llm";
import { chatRequestsSent, completion, jsonResponse, stubBifrost, TEST_ENVIRONMENT } from "@/tests/support/testDoubles";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseJson", () => {
  it("parses clean JSON", () => {
    expect(parseJson('{"claims": []}')).toEqual({ ok: true, value: { claims: [] } });
  });

  it("parses JSON wrapped in a code fence", () => {
    expect(parseJson('```json\n{"claims": [1]}\n```')).toEqual({ ok: true, value: { claims: [1] } });
  });

  it("parses the outer object when the model adds prose around it", () => {
    expect(parseJson('Here you go: {"a": {"b": 1}} Hope this helps.')).toEqual({ ok: true, value: { a: { b: 1 } } });
  });

  it("returns a failure instead of throwing when there is no JSON", () => {
    expect(parseJson("I found nothing relevant.")).toEqual({ ok: false });
    expect(parseJson("{not json}")).toEqual({ ok: false });
  });
});

describe("chat", () => {
  it("posts an OpenAI-format request with the configured model and temperature 0", async () => {
    const fetchMock = stubBifrost(() => completion("hello"));
    const reply = await createModelClient(TEST_ENVIRONMENT).chat("system text", "user text");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(reply.text).toBe("hello");
    expect(url).toBe("http://bifrost.test/v1/chat/completions");
    expect(init?.headers).not.toHaveProperty("x-bf-vk");
    expect(chatRequestsSent(fetchMock)[0]).toEqual({
      model: "test-provider/test-model",
      temperature: 0,
      messages: [
        { role: "system", content: "system text" },
        { role: "user", content: "user text" },
      ],
    });
  });

  it("sends the fallbacks and the virtual key when they are configured", async () => {
    const fetchMock = stubBifrost(() => completion("hello"));
    const environment = {
      ...TEST_ENVIRONMENT,
      BIFROST_API_KEY: "vk-test-not-real",
      BIFROST_FALLBACK_MODELS: ["provider-a/model-one", "provider-b/model-two"],
    };
    await createModelClient(environment).chat("system", "user");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ "x-bf-vk": "vk-test-not-real" });
    expect(chatRequestsSent(fetchMock)[0]?.fallbacks).toEqual(["provider-a/model-one", "provider-b/model-two"]);
  });

  it("reads which provider and model answered from extra_fields.routing_info", async () => {
    const routingInfo = { provider: "provider-b", model: "model-two", is_fallback: true, primary_provider: "provider-a", primary_model: "model-one" };
    stubBifrost(() => completion("hello", { routing_info: routingInfo, latency: 1.2 }));
    const reply = await createModelClient(TEST_ENVIRONMENT).chat("system", "user");
    expect(reply.routing).toEqual({ provider: "provider-b", model: "model-two", isFallback: true });
  });

  it("treats a missing or odd extra_fields as unknown, not as an error", async () => {
    stubBifrost(() => completion("hello"));
    const client = createModelClient(TEST_ENVIRONMENT);
    expect((await client.chat("system", "user")).routing).toEqual({ provider: "unknown", model: "unknown", isFallback: null });
    stubBifrost(() => completion("hello", { routing_info: "unexpected" }));
    expect((await client.chat("system", "user")).routing.provider).toBe("unknown");
  });

  it("throws a typed error on a non-200 response without echoing the request", async () => {
    stubBifrost(() => jsonResponse({ error: "upstream failed" }, 500));
    const error: unknown = await createModelClient(TEST_ENVIRONMENT).chat("secret system", "secret user").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ kind: "http", status: 500 });
    expect(error instanceof Error ? error.message : "").not.toContain("secret");
  });

  it("logs that a key is needed when Bifrost answers 401 and no key was sent", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const required = { type: "virtual_key_required", status_code: 401, error: { message: "virtual key is required." } };
    stubBifrost(() => jsonResponse(required, 401));
    await expect(createModelClient(TEST_ENVIRONMENT).chat("system", "user")).rejects.toMatchObject({ kind: "unauthorized", status: 401 });
    expect(log).toHaveBeenCalledWith("Bifrost requires a key: set BIFROST_API_KEY (virtual_key_required, status 401)");
  });

  it("logs that the key was refused when one was sent, without logging the key", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubBifrost(() => jsonResponse({ type: "access_blocked", error: { message: "virtual key is inactive" } }, 403));
    const environment = { ...TEST_ENVIRONMENT, BIFROST_API_KEY: "vk-test-not-real" };
    await expect(createModelClient(environment).chat("system", "user")).rejects.toMatchObject({ kind: "unauthorized", status: 403 });
    expect(String(log.mock.calls[0]?.[0])).toMatch(/^Bifrost refused BIFROST_API_KEY \(access_blocked, status 403\)/);
    expect(JSON.stringify(log.mock.calls)).not.toContain("vk-test-not-real");
  });

  it("logs only a short error code from Bifrost's body, never free text", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubBifrost(() => jsonResponse({ type: "Something <script> long and odd" }, 401));
    await expect(createModelClient(TEST_ENVIRONMENT).chat("system", "user")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(log).toHaveBeenCalledWith("Bifrost requires a key: set BIFROST_API_KEY (status 401)");
  });

  it("with BIFROST_MODEL=auto, asks Bifrost once for its models and uses them with fallbacks", async () => {
    const models = () => jsonResponse({ data: [{ id: "groq/openai/gpt-oss-120b" }, { id: "groq/whisper-large-v3" }, { id: "openai/gpt-4o-mini" }] });
    const fetchMock = stubBifrost(() => completion("hello"), models);
    const client = createModelClient({ ...TEST_ENVIRONMENT, BIFROST_MODEL: "auto", BIFROST_API_KEY: "sk-bf-test-not-real" });
    await client.chat("system", "user");
    await client.chat("system", "user");
    const listCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/v1/models"));
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0]?.[1]?.headers).toMatchObject({ "x-bf-vk": "sk-bf-test-not-real" });
    expect(chatRequestsSent(fetchMock)[0]).toMatchObject({ model: "groq/openai/gpt-oss-120b", fallbacks: ["openai/gpt-4o-mini"] });
  });

  it("with auto, skips a model that refuses the request and keeps it skipped for the briefing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const models = () => jsonResponse({ data: [{ id: "gemini/learnlm-2.0-flash" }, { id: "groq/openai/gpt-oss-120b" }] });
    const refusal = { error: { message: "Developer instruction is not enabled for models/learnlm-2.0-flash" } };
    const fetchMock = stubBifrost((request) => (request.model === "gemini/learnlm-2.0-flash" ? jsonResponse(refusal, 400) : completion("hello")), models);
    const client = createModelClient({ ...TEST_ENVIRONMENT, BIFROST_MODEL: "auto" });
    expect((await client.chat("system", "user")).text).toBe("hello");
    await client.chat("system", "user");
    expect(chatRequestsSent(fetchMock).map((request) => request.model)).toEqual(["gemini/learnlm-2.0-flash", "groq/openai/gpt-oss-120b", "groq/openai/gpt-oss-120b"]);
    expect(log.mock.calls.map(([line]) => String(line))).toEqual([
      "Bifrost /v1/chat/completions failed (status 400: Developer instruction is not enabled for models/learnlm-2.0-flash)",
      "Skipping gemini/learnlm-2.0-flash for this briefing: it cannot be used. Trying the next available model.",
    ]);
  });

  it("never swaps a model named in BIFROST_MODEL", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = stubBifrost(() => jsonResponse({ error: { message: "bad request" } }, 400));
    await expect(createModelClient(TEST_ENVIRONMENT).chat("system", "user")).rejects.toMatchObject({ kind: "http", status: 400 });
    expect(chatRequestsSent(fetchMock)).toHaveLength(1);
  });

  it("masks anything key-like in a logged Bifrost error message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubBifrost(() => jsonResponse({ error: { message: "Provider said: invalid key gsk_abcdefghijklmnop1234" } }, 502));
    await expect(createModelClient(TEST_ENVIRONMENT).chat("system", "user")).rejects.toMatchObject({ status: 502 });
    expect(String(log.mock.calls[0]?.[0])).toBe("Bifrost /v1/chat/completions failed (status 502: Provider said: invalid key [hidden])");
  });

  it("fails the call with a clear log when auto finds no chat model", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = stubBifrost(() => completion("hello"), () => jsonResponse({ data: [] }));
    const result = await createModelClient({ ...TEST_ENVIRONMENT, BIFROST_MODEL: "auto" }).chatJson("system", "user", z.object({}));
    expect(result).toEqual({ ok: false, failure: "unavailable" });
    expect(String(log.mock.calls[0]?.[0])).toContain("Bifrost listed no chat model that accepted the request");
    expect(chatRequestsSent(fetchMock)).toHaveLength(0);
  });

  it("aborts after 40 seconds with a timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );
    const assertion = expect(createModelClient(TEST_ENVIRONMENT).chat("system", "user")).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(40_000);
    await assertion;
  });
});
