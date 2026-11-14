import { describe, expect, it, vi } from "vitest";
import { LlmError } from "@/lib/model/llmErrors";
import { chatModelIds, chooseModels, createModelPicker, needsModelList } from "@/lib/model/modelChoice";

const listed = {
  object: "list",
  data: [
    { id: "groq/openai/gpt-oss-120b", object: "model", active: true },
    { id: "groq/whisper-large-v3", object: "model" },
    { id: "openai/text-embedding-3-small", object: "model" },
    { id: "groq/meta-llama/llama-guard-4-12b", object: "model" },
    { id: "openai/gpt-4o-mini", object: "model" },
    { id: "anthropic/claude-haiku", object: "model", active: false },
    { id: "groq/openai/gpt-oss-120b", object: "model" },
    { id: "no-provider-prefix", object: "model" },
    { id: "mistral/mistral-small", object: "model" },
    { id: "gemini/gemini-flash", object: "model" },
  ],
};

describe("chatModelIds", () => {
  it("keeps active, provider-prefixed chat models once each, in Bifrost's order", () => {
    expect(chatModelIds(listed)).toEqual(["groq/openai/gpt-oss-120b", "openai/gpt-4o-mini", "mistral/mistral-small", "gemini/gemini-flash"]);
  });

  it("skips task-specific Gemini families and puts stable models before previews", () => {
    const gemini = {
      data: [
        { id: "gemini/antigravity-preview-05-2026" },
        { id: "gemini/aqa" },
        { id: "gemini/gemini-2.5-flash-preview-09-2025" },
        { id: "gemini/gemini-2.5-flash" },
        { id: "gemini/gemini-2.5-flash-native-audio-latest" },
        { id: "gemini/veo-3.0-generate-001" },
        { id: "gemini/gemini-2.0-flash-exp" },
        { id: "groq/openai/gpt-oss-120b" },
      ],
    };
    expect(chatModelIds(gemini)).toEqual([
      "gemini/gemini-2.5-flash",
      "groq/openai/gpt-oss-120b",
      "gemini/gemini-2.5-flash-preview-09-2025",
      "gemini/gemini-2.0-flash-exp",
    ]);
  });

  it("returns nothing for a body that is not a model list", () => {
    expect(chatModelIds({ error: "nope" })).toEqual([]);
    expect(chatModelIds(null)).toEqual([]);
  });
});

describe("chooseModels", () => {
  const available = chatModelIds(listed);

  it("with auto, uses the first available model and up to three others as fallbacks", () => {
    expect(chooseModels({ model: "auto", fallbacks: [] }, available)).toEqual({
      model: "groq/openai/gpt-oss-120b",
      fallbacks: ["openai/gpt-4o-mini", "mistral/mistral-small", "gemini/gemini-flash"],
    });
  });

  it("keeps a chosen model and fills only the fallbacks when they are auto", () => {
    expect(chooseModels({ model: "openai/gpt-4o-mini", fallbacks: "auto" }, available)).toEqual({
      model: "openai/gpt-4o-mini",
      fallbacks: ["groq/openai/gpt-oss-120b", "mistral/mistral-small", "gemini/gemini-flash"],
    });
  });

  it("keeps explicit settings as they are and needs no list for them", () => {
    const settings = { model: "groq/openai/gpt-oss-120b", fallbacks: ["openai/gpt-4o-mini"] };
    expect(needsModelList(settings)).toBe(false);
    expect(chooseModels(settings, [])).toEqual(settings);
  });

  it("returns null when auto finds no chat model", () => {
    expect(chooseModels({ model: "auto", fallbacks: [] }, [])).toBeNull();
  });
});

describe("chatModelIds compatibility", () => {
  it("leaves out speech models and Gemma, which cannot take a briefing's system instructions", () => {
    const body = { data: [{ id: "groq/canopylabs/orpheus-v1-english" }, { id: "gemini/gemma-3-27b-it" }, { id: "groq/qwen/qwen3.8-27b" }] };
    expect(chatModelIds(body)).toEqual(["groq/qwen/qwen3.8-27b"]);
  });
});

describe("createModelPicker", () => {
  const models = { data: [{ id: "groq/openai/gpt-oss-120b" }, { id: "groq/openai/gpt-oss-20b" }, { id: "gemini/gemini-2.5-flash" }, { id: "gemini/gemini-2.5-pro" }] };
  const auto = { model: "auto", fallbacks: "auto" } as const;

  it("skips one model that cannot be used and keeps its provider", async () => {
    const picker = createModelPicker(auto, async () => models);
    expect(picker.refuse("groq/openai/gpt-oss-120b", new LlmError("model-unavailable", 403))).toBe(true);
    expect((await picker.current()).model).toBe("groq/openai/gpt-oss-20b");
  });

  it("skips every model of a provider whose key is refused", async () => {
    const picker = createModelPicker(auto, async () => models);
    expect(picker.refuse("groq/openai/gpt-oss-120b", new LlmError("provider-unavailable", 401))).toBe(true);
    expect(await picker.current()).toEqual({ model: "gemini/gemini-2.5-flash", fallbacks: ["gemini/gemini-2.5-pro"] });
  });

  it("does not switch models when the gateway refuses Foreword's own key, or when a model was named", async () => {
    expect(createModelPicker(auto, async () => models).refuse("groq/openai/gpt-oss-120b", new LlmError("unauthorized", 401))).toBe(false);
    const named = createModelPicker({ model: "groq/openai/gpt-oss-120b", fallbacks: [] }, async () => models);
    expect(named.refuse("groq/openai/gpt-oss-120b", new LlmError("model-unavailable", 403))).toBe(false);
  });
});

describe("createModelPicker when Bifrost cannot list its models", () => {
  it("still uses a named model, with no fallbacks", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const picker = createModelPicker({ model: "groq/openai/gpt-oss-120b", fallbacks: "auto" }, async () => {
      throw new LlmError("http", 504);
    });
    expect(await picker.current()).toEqual({ model: "groq/openai/gpt-oss-120b", fallbacks: [] });
    log.mockRestore();
  });

  it("with auto, asks again on the next call instead of keeping the failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listModels = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new LlmError("http", 504))
      .mockResolvedValueOnce({ data: [{ id: "groq/openai/gpt-oss-20b" }] });
    const picker = createModelPicker({ model: "auto", fallbacks: "auto" }, listModels);
    await expect(picker.current()).rejects.toMatchObject({ kind: "no-models" });
    expect((await picker.current()).model).toBe("groq/openai/gpt-oss-20b");
    expect(listModels).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
