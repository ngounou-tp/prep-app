// Runs the real research once and prints one line per source. Spends Tavily credits.
// Usage: npm run try-research -- "Northwind Freight" "person:Amara Diallo@Northwind Freight"
import { z } from "zod";
import { readEnvironment } from "@/lib/config/env";
import { researchAll } from "@/lib/research/tavily";
import { briefingInputSchema } from "@/lib/types";
import { researchWindow } from "@/lib/research/window";
import { fail, loadLocalEnvironment, parseSubject, printable, runMain, SUBJECT_SYNTAX, write } from "./cli";

const USAGE = `Usage: npm run try-research -- <subject> [<subject> ...]\n${SUBJECT_SYNTAX}`;

async function main(subjectArguments: string[]): Promise<number> {
  if (subjectArguments.length === 0) {
    return fail(USAGE);
  }
  loadLocalEnvironment();
  const now = new Date();
  const input = briefingInputSchema.safeParse({
    meetingAt: now.toISOString(),
    meetingType: "first-intro",
    subjects: subjectArguments.map(parseSubject),
  });
  if (!input.success) {
    return fail(`Invalid subjects:\n${z.prettifyError(input.error)}\n${USAGE}`);
  }
  const searchWindow = researchWindow(input.data.meetingAt, now);
  const { sources, failedSubjectIds } = await researchAll(input.data.subjects, searchWindow, readEnvironment());
  const nameById = new Map(input.data.subjects.map((subject) => [subject.id, subject.name]));

  write(`Window ${searchWindow.startDate} to ${searchWindow.endDate} (end exclusive): ${sources.length} sources`);
  for (const source of sources) {
    const subjects = source.subjectIds.map((id) => nameById.get(id) ?? id).join(", ");
    write([source.id, source.publishedDate ?? "undated", source.domain, printable(source.title), `[${subjects}]`].join("\t"));
  }
  if (failedSubjectIds.length > 0) {
    write(`Subjects with errors: ${failedSubjectIds.map((id) => nameById.get(id) ?? id).join(", ")}`);
  }
  return 0;
}

runMain(() => main(process.argv.slice(2)));
