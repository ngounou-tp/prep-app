// A saved briefing for building and demoing the UI without spending credits. Development only.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EnvironmentSource } from "@/lib/config/env";
import { briefingResultSchema, type BriefingResult } from "@/lib/types";

export const FIXTURE_PATH = path.join(process.cwd(), "fixtures", "sample-briefing.json");

// Requires NODE_ENV=development as well as USE_FIXTURE=1, so a stray flag can never serve
// saved data in production.
export function isFixtureMode(source: EnvironmentSource): boolean {
  return source.NODE_ENV === "development" && source.USE_FIXTURE === "1";
}

export async function loadFixtureBriefing(fixturePath: string = FIXTURE_PATH): Promise<BriefingResult> {
  let text: string;
  try {
    // Development-only read of a known file; the comment stops the build from bundling the whole project.
    text = await readFile(/* turbopackIgnore: true */ fixturePath, "utf8");
  } catch (error) {
    throw new Error(
      "USE_FIXTURE=1 but fixtures/sample-briefing.json is missing. Run npm run try-briefing, then npm run save-fixture.",
      { cause: error },
    );
  }
  const json: unknown = JSON.parse(text);
  return briefingResultSchema.parse(json);
}
