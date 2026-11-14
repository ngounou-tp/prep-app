// Kept out of the component so the rules can be tested: 1 to 5 subjects, no duplicates by name
// and type, checked with the shared schema.
import { fieldMessage } from "@/lib/shared/fieldMessages";
import { briefingInputSchema, normaliseName, type Subject } from "@/lib/types";

export const MAX_SUBJECTS = 5;

export type SubjectDraft = { name: string; type: Subject["type"]; company: string };

type AddResult = { ok: true; subjects: Subject[]; added: Subject } | { ok: false; field: "name" | "company"; message: string };

export function addSubject(subjects: readonly Subject[], draft: SubjectDraft, id: string): AddResult {
  const name = draft.name.trim();
  if (name === "") {
    return { ok: false, field: "name", message: "Type a name, then press Add." };
  }
  if (subjects.length >= MAX_SUBJECTS) {
    return { ok: false, field: "name", message: "A briefing covers at most 5 people and companies." };
  }
  const company = draft.type === "person" && draft.company.trim() !== "" ? draft.company.trim() : undefined;
  const candidate: Subject = { id, name, type: draft.type, company, context: undefined };
  const parsed = briefingInputSchema.shape.subjects.safeParse([...subjects, candidate]);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.includes("company") ? "company" : "name";
    const duplicate = issue.code === "custom" && issue.path.includes("name");
    return { ok: false, field, message: duplicate ? `${name} is already in the list.` : fieldMessage(issue) };
  }
  return { ok: true, subjects: parsed.data, added: parsed.data[parsed.data.length - 1] };
}

// After a removal, focus moves to the row that took its place, or to the name field (null).
export function removeSubject(subjects: readonly Subject[], id: string): { subjects: Subject[]; focusId: string | null } {
  const index = subjects.findIndex((subject) => subject.id === id);
  const remaining = subjects.filter((subject) => subject.id !== id);
  return { subjects: remaining, focusId: remaining[index]?.id ?? null };
}

// Companies already on the list, offered when typing a person's company.
export function companySuggestions(subjects: readonly Subject[]): string[] {
  const names = subjects.flatMap((subject) => (subject.type === "company" ? [subject.name] : subject.company === undefined ? [] : [subject.company]));
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normaliseName(name);
    const fresh = !seen.has(key);
    seen.add(key);
    return fresh;
  });
}

export function describeSubject(subject: Subject): string {
  if (subject.type === "company") {
    return "Company";
  }
  return subject.company === undefined ? "Person" : `Person · ${subject.company}`;
}

export function nextSubjectId(subjects: readonly Subject[]): string {
  const used = new Set(subjects.map((subject) => subject.id));
  let number = subjects.length + 1;
  while (used.has(`s${number}`)) {
    number += 1;
  }
  return `s${number}`;
}
