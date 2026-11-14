// Checks that Bifrost answers with the settings in .env.local: one tiny model call, no searches.
// Prints whether a key is configured, never the key itself, the URL or any other value.
// Usage: npm run check-model
import { z } from "zod";
import { readEnvironment } from "@/lib/config/env";
import { createModelClient } from "@/lib/model/llm";
import { fail, loadLocalEnvironment, runMain, write } from "./cli";

const replySchema = z.object({ ok: z.literal(true) });

async function main(): Promise<number> {
  loadLocalEnvironment();
  const environment = readEnvironment();
  write(`BIFROST_API_KEY: ${environment.BIFROST_API_KEY === undefined ? "not set" : "set"}`);
  write(`BIFROST_MODEL: ${environment.BIFROST_MODEL}`);
  const fallbacks = environment.BIFROST_FALLBACK_MODELS;
  write(`BIFROST_FALLBACK_MODELS: ${fallbacks === "auto" ? "auto" : `${fallbacks.length} listed`}`);
  const model = createModelClient(environment);
  const result = await model.chatJson("Reply with JSON only.", 'Reply with exactly {"ok": true}', replySchema);
  if (!result.ok) {
    return fail(`The model call failed: ${result.failure}. The line above, if any, says why.`);
  }
  const { provider, model: answeredBy, isFallback } = result.routing;
  write(`Bifrost answered. Provider: ${provider}, model: ${answeredBy}${isFallback === true ? " (fallback used)" : ""}.`);
  return 0;
}

runMain(main);
