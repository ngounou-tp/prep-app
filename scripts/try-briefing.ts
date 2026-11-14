// Runs one real briefing (Tavily and Bifrost), prints it, and saves it to .briefings/latest.json
// so `npm run save-fixture` can turn it into the development fixture. Spends credits.
// Usage: npm run try-briefing -- [--type=sales-call] [--meeting=2026-11-19T10:00:00Z] <subject> ...
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createBriefing } from "@/lib/briefing/briefing";
import { briefingInputSchema, type BriefingResult } from "@/lib/types";
import { fail, LATEST_BRIEFING_PATH, loadLocalEnvironment, parseSubject, printable, runMain, SUBJECT_SYNTAX, write } from "./cli";

const USAGE = [
  "Usage: npm run try-briefing -- [--type=sales-call|investor|partnership|first-intro] [--meeting=ISO-date-time] <subject> ...",
  SUBJECT_SYNTAX,
].join("\n");

function optionValue(argumentsList: readonly string[], name: string): string | undefined {
  return argumentsList.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function printSubjects(briefing: BriefingResult): void {
  const claimById = new Map(briefing.claims.map((claim) => [claim.id, claim]));
  for (const section of briefing.subjects) {
    const subject = briefing.input.subjects.find((candidate) => candidate.id === section.subjectId);
    const { verified, singleSource, unconfirmed } = section.counts;
    write(`\n== ${subject?.name ?? section.subjectId}: ${verified} verified, ${singleSource} single source, ${unconfirmed} could not verify`);
    if (section.line !== null) {
      write(`   ${printable(section.line)}`);
    }
    for (const claimId of section.shownClaimIds) {
      const claim = claimById.get(claimId);
      if (claim !== undefined) {
        write(`   ${claim.id}\t${claim.status}\t${claim.date ?? "undated"}\t${printable(claim.text)}\t[${claim.sourceIds.join(", ")}]`);
      }
    }
    if (section.moreCount > 0) {
      write(`   ${section.moreCount} more not shown`);
    }
    if (section.note !== null) {
      write(`   Note: ${section.note.message}`);
    }
  }
}

function printSummary(briefing: BriefingResult): void {
  const nameById = new Map(briefing.input.subjects.map((subject) => [subject.id, subject.name]));
  write(`\nSnapshot: ${briefing.snapshot === null ? "(the writing call failed)" : printable(briefing.snapshot)}`);
  briefing.questions.forEach((question, index) => {
    const about = question.subjectIds.map((id) => nameById.get(id) ?? id).join(", ");
    write(`Q${index + 1}. ${printable(question.text)} (${about}, ${question.claimId})`);
  });
  for (const claim of briefing.claims.filter((candidate) => candidate.status === "unconfirmed")) {
    write(`Could not verify: ${claim.id} ${printable(claim.text)}`);
  }
  write(`Shared claims: ${briefing.sharedClaimIds.join(", ") || "none"}`);
  for (const call of briefing.modelCalls) {
    const fallback = call.isFallback === true ? ", fallback used" : "";
    write(`Answered by ${call.provider}/${call.model}${fallback} (${call.purpose}${call.subjectId === null ? "" : ` ${call.subjectId}`})`);
  }
}

async function main(argumentsList: string[]): Promise<number> {
  const subjectArguments = argumentsList.filter((argument) => !argument.startsWith("--"));
  if (subjectArguments.length === 0) {
    return fail(USAGE);
  }
  loadLocalEnvironment();
  const now = new Date();
  const input = briefingInputSchema.safeParse({
    meetingAt: optionValue(argumentsList, "meeting") ?? now.toISOString(),
    meetingType: optionValue(argumentsList, "type") ?? "first-intro",
    subjects: subjectArguments.map(parseSubject),
  });
  if (!input.success) {
    return fail(`Invalid input:\n${z.prettifyError(input.error)}\n${USAGE}`);
  }
  const briefing = await createBriefing(input.data, now);
  write(`Read ${briefing.window.startDate} to ${briefing.window.lastDate}: ${briefing.sources.length} sources cited`);
  printSubjects(briefing);
  printSummary(briefing);
  await mkdir(path.dirname(LATEST_BRIEFING_PATH), { recursive: true });
  await writeFile(LATEST_BRIEFING_PATH, `${JSON.stringify(briefing, null, 2)}\n`, "utf8");
  write(`\nSaved to .briefings/latest.json. Run npm run save-fixture to use it as the development fixture.`);
  return 0;
}

runMain(() => main(process.argv.slice(2)));
