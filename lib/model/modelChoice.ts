// Picks the model and fallbacks for a briefing. With "auto", they come from the models Bifrost
// says its providers offer (GET /v1/models), so a new provider or model needs no code change.
import { z } from "zod";
import { LlmError } from "@/lib/model/llmErrors";

export const AUTO = "auto";

// Each fallback Bifrost tries costs time inside the 55-second budget, so the chain stays short.
const MAX_AUTO_FALLBACKS = 3;

// Models that cannot answer a chat request: embeddings, speech (Orpheus, Whisper), images, video,
// music, moderation, safety classifiers, task-specific Gemini families (aqa, antigravity), and
// Gemma, which the Gemini API serves without system instructions, and every call here has one.
// bifrost/config.json blocks the same families for Foreword's virtual key.
const NOT_FOR_CHAT = /embed|whisper|orpheus|tts|speech|transcri|audio|dall-e|image|veo|lyria|moderation|rerank|guard|aqa|antigravity|gemma|computer-use|robotics|-live\b/i;

// Preview and experimental models change without notice and often reject plain requests, so
// stable models are tried first.
const UNSTABLE = /preview|\bexp\b|experimental|beta|alpha/i;

function stableFirst(first: string, second: string): number {
  return Number(UNSTABLE.test(first)) - Number(UNSTABLE.test(second));
}

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string(), active: z.boolean().optional() }).loose()),
});

export type ModelSettings = { model: string; fallbacks: readonly string[] | typeof AUTO };
export type ModelChoice = { model: string; fallbacks: readonly string[] };

export function needsModelList(settings: ModelSettings): boolean {
  return settings.model === AUTO || settings.fallbacks === AUTO;
}

// Chat models from Bifrost's list: provider-prefixed, active ones only, stable before preview,
// otherwise in Bifrost's order.
export function chatModelIds(body: unknown): string[] {
  const parsed = modelListSchema.safeParse(body);
  if (!parsed.success) {
    return [];
  }
  const ids = parsed.data.data
    .filter((entry) => entry.active !== false && entry.id.includes("/") && !NOT_FOR_CHAT.test(entry.id))
    .map((entry) => entry.id);
  return [...new Set(ids)].sort(stableFirst);
}

// Null when "auto" was asked for but no chat model is available.
export function chooseModels(settings: ModelSettings, available: readonly string[]): ModelChoice | null {
  const model = settings.model === AUTO ? available[0] : settings.model;
  if (model === undefined) {
    return null;
  }
  // Explicit fallbacks are kept; "auto", or an automatic model with none listed, fills them in.
  if (settings.fallbacks !== AUTO && (settings.model !== AUTO || settings.fallbacks.length > 0)) {
    return { model, fallbacks: settings.fallbacks };
  }
  return { model, fallbacks: available.filter((id) => id !== model).slice(0, MAX_AUTO_FALLBACKS) };
}

// Statuses that mean "this model will not take this request", as opposed to the gateway failing.
const MODEL_REFUSALS: ReadonlySet<number> = new Set([400, 404, 422]);

function providerOf(model: string): string {
  return model.split("/")[0] ?? model;
}

function refusalOf(error: unknown): "model" | "provider" | null {
  if (!(error instanceof LlmError)) {
    return null;
  }
  if (error.kind === "provider-unavailable") {
    return "provider";
  }
  const refusedByModel = error.kind === "http" && MODEL_REFUSALS.has(error.status ?? 0);
  return refusedByModel || error.kind === "model-unavailable" ? "model" : null;
}

// With "auto", a listed model can still be unusable: it refuses the request, the plan gives it no
// quota, or its provider's key is refused (Bifrost then still lists that provider's models from
// its catalog). Each is skipped for the rest of the briefing, a whole provider at once when its
// key fails. A model named in BIFROST_MODEL is never swapped. `listModels` runs at most once.
export function createModelPicker(settings: ModelSettings, listModels: () => Promise<unknown>) {
  let available: Promise<string[]> | null = null;
  const refused = new Set<string>();
  const refusedProviders = new Set<string>();
  const usable = (id: string) => !refused.has(id) && !refusedProviders.has(providerOf(id));

  // One slow provider can make Bifrost's list time out. A named model is still used, without
  // fallbacks, and a failed list is not kept, so the next call asks again.
  const loadList = async (): Promise<string[]> => {
    try {
      return chatModelIds(await listModels());
    } catch {
      console.error("Bifrost could not list its models this time; continuing without that list.");
      available = null;
      return [];
    }
  };

  const current = async (): Promise<ModelChoice> => {
    available ??= needsModelList(settings) ? loadList() : Promise.resolve([]);
    const choice = chooseModels(settings, (await available).filter(usable));
    if (choice === null) {
      console.error("Bifrost listed no chat model that accepted the request. Add a provider in the Bifrost dashboard, or set BIFROST_MODEL to a provider/model id.");
      throw new LlmError("no-models", null);
    }
    return choice;
  };

  // True when the call should be tried again with the next model.
  const refuse = (model: string, error: unknown): boolean => {
    const refusal = refusalOf(error);
    if (settings.model !== AUTO || refusal === null) {
      return false;
    }
    if (refusal === "provider") {
      refusedProviders.add(providerOf(model));
      console.error(`Skipping every ${providerOf(model)} model for this briefing: the provider refused its key.`);
    } else {
      refused.add(model);
      console.error(`Skipping ${model} for this briefing: it cannot be used. Trying the next available model.`);
    }
    return true;
  };

  return { current, refuse };
}
