// Shared helpers for the scripts. Output goes through process.stdout and stderr, never console.log.
import path from "node:path";

export const LATEST_BRIEFING_PATH = path.join(process.cwd(), ".briefings", "latest.json");

export const SUBJECT_SYNTAX = [
  "Subjects (1 to 5):",
  '  "Northwind Freight"                       a company',
  '  "person:Amara Diallo"                     a person',
  '  "person:Amara Diallo@Northwind Freight"   a person and their company',
].join("\n");

export function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

export function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 1;
}

// Text from the web or the model; strip control characters so it cannot drive the terminal.
export function printable(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
}

export function parseSubject(argument: string, index: number) {
  const id = `subject-${index + 1}`;
  if (!argument.startsWith("person:")) {
    return { id, name: argument, type: "company" };
  }
  const [name, company] = argument.slice("person:".length).split("@");
  return { id, name, type: "person", company };
}

// Loads the variables into process.env without printing them; the shell environment is the fallback.
export function loadLocalEnvironment(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    process.stderr.write("No .env.local in the current folder; using the shell environment.\n");
  }
}

export function runMain(main: () => Promise<number>): void {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      process.exitCode = fail(error instanceof Error ? error.message : "The script failed");
    },
  );
}
