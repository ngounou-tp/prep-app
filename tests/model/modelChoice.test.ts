import { describe, expect, it } from "vitest";
import { chatModelIds, chooseModels, needsModelList } from "@/lib/model/modelChoice";

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
