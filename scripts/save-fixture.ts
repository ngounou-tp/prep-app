// Copies the latest real briefing (written by `npm run try-briefing`) to the development fixture,
// after checking it against the result schema. Makes no network call.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FIXTURE_PATH } from "@/lib/config/fixtures";
import { briefingResultSchema } from "@/lib/types";
import { fail, LATEST_BRIEFING_PATH, runMain, write } from "./cli";

async function main(): Promise<number> {
  let text: string;
  try {
    text = await readFile(LATEST_BRIEFING_PATH, "utf8");
  } catch {
    return fail("No .briefings/latest.json yet. Run npm run try-briefing first.");
  }
  const json: unknown = JSON.parse(text);
  const briefing = briefingResultSchema.safeParse(json);
  if (!briefing.success) {
    return fail("The latest briefing does not match the result schema; run npm run try-briefing again.");
  }
  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, `${JSON.stringify(briefing.data, null, 2)}\n`, "utf8");
  write(`Saved fixtures/sample-briefing.json from the briefing generated at ${briefing.data.generatedAt}.`);
  return 0;
}

runMain(main);
