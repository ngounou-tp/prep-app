// The briefing page's URL holds its whole input, so it can be reloaded and shared:
// /briefing?at=<ISO>&type=<meeting type>&s=<subjects as compact JSON, base64url>.
import { z } from "zod";
import { briefingInputSchema, type BriefingInput } from "@/lib/types";

const MAX_SUBJECTS_PARAMETER_LENGTH = 2000;

const compactSubjectsSchema = z
  .array(z.object({ n: z.string(), t: z.enum(["c", "p"]), co: z.string().optional(), cx: z.string().optional() }))
  .max(5);

type SearchParams = Record<string, string | string[] | undefined>;

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    return null;
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function briefingSearchParams(input: BriefingInput): string {
  const compact = input.subjects.map((subject) => ({
    n: subject.name,
    t: subject.type === "company" ? "c" : "p",
    ...(subject.company === undefined ? {} : { co: subject.company }),
    ...(subject.context === undefined ? {} : { cx: subject.context }),
  }));
  const params = new URLSearchParams({ at: input.meetingAt, type: input.meetingType, s: toBase64Url(JSON.stringify(compact)) });
  if (input.meetingTopic !== undefined) {
    params.set("topic", input.meetingTopic);
  }
  return params.toString();
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseCompactSubjects(encoded: string): z.infer<typeof compactSubjectsSchema> | null {
  const json = fromBase64Url(encoded);
  if (json === null) {
    return null;
  }
  try {
    const parsed = compactSubjectsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Returns null for anything missing, too long or invalid; the caller sends the user back.
export function readBriefingSearchParams(params: SearchParams): BriefingInput | null {
  const encoded = single(params.s);
  if (encoded === undefined || encoded.length > MAX_SUBJECTS_PARAMETER_LENGTH) {
    return null;
  }
  const compact = parseCompactSubjects(encoded);
  if (compact === null) {
    return null;
  }
  const subjects = compact.map((subject, index) => ({
    id: `s${index + 1}`,
    name: subject.n,
    type: subject.t === "c" ? "company" : "person",
    company: subject.co,
    context: subject.cx,
  }));
  const input = briefingInputSchema.safeParse({ meetingAt: single(params.at), meetingType: single(params.type), meetingTopic: single(params.topic), subjects });
  return input.success ? input.data : null;
}
