// "My briefings": finished briefings kept in this browser (IndexedDB), so they can be reopened
// without running the research again. Nothing leaves the device and no account is needed.
import { briefingResultSchema, type BriefingResult } from "@/lib/types";
import { meetingTypeLabel } from "./meetingForm";

const DATABASE = "foreword";
const STORE = "briefings";
// Oldest ones are dropped beyond this, so storage stays small.
export const MAX_SAVED_BRIEFINGS = 30;

export type SavedBriefing = { id: string; savedAt: string; briefing: BriefingResult };
export type SavedSummary = { id: string; savedAt: string; meetingAt: string; title: string; subjects: string; findings: number };

export function summarize(saved: SavedBriefing): SavedSummary {
  const { input, counts } = saved.briefing;
  return {
    id: saved.id,
    savedAt: saved.savedAt,
    meetingAt: input.meetingAt,
    title: meetingTypeLabel(input),
    subjects: input.subjects.map((subject) => subject.name).join(", "),
    findings: counts.verified + counts.singleSource,
  };
}

// Newest first; the ids past the limit are the ones to delete.
export function newestFirst(saved: readonly SavedBriefing[]): { keep: SavedBriefing[]; drop: string[] } {
  const sorted = [...saved].sort((first, second) => second.savedAt.localeCompare(first.savedAt));
  return { keep: sorted.slice(0, MAX_SAVED_BRIEFINGS), drop: sorted.slice(MAX_SAVED_BRIEFINGS).map((entry) => entry.id) };
}

// Stored data may come from an older version of the app, so every entry is checked on read.
export function validSaved(entry: unknown): SavedBriefing | null {
  if (typeof entry !== "object" || entry === null || !("id" in entry) || !("savedAt" in entry) || !("briefing" in entry)) {
    return null;
  }
  const briefing = briefingResultSchema.safeParse(entry.briefing);
  return briefing.success && typeof entry.id === "string" && typeof entry.savedAt === "string"
    ? { id: entry.id, savedAt: entry.savedAt, briefing: briefing.data }
    : null;
}

function request<Result>(make: (store: IDBObjectStore) => IDBRequest<Result>, mode: IDBTransactionMode): Promise<Result> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE, { keyPath: "id" });
    opening.onerror = () => reject(opening.error ?? new Error("Could not open saved briefings"));
    opening.onsuccess = () => {
      const call = make(opening.result.transaction(STORE, mode).objectStore(STORE));
      call.onsuccess = () => resolve(call.result);
      call.onerror = () => reject(call.error ?? new Error("Saved briefings request failed"));
    };
  });
}

export function savedBriefingsAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function listSaved(): Promise<SavedBriefing[]> {
  const all = await request<unknown[]>((store) => store.getAll(), "readonly");
  return newestFirst(all.flatMap((entry) => validSaved(entry) ?? [])).keep;
}

export async function getSaved(id: string): Promise<SavedBriefing | null> {
  return validSaved(await request<unknown>((store) => store.get(id), "readonly"));
}

export async function putSaved(saved: SavedBriefing): Promise<void> {
  await request((store) => store.put(saved), "readwrite");
  const all = await request<unknown[]>((store) => store.getAll(), "readonly");
  const { drop } = newestFirst(all.flatMap((entry) => validSaved(entry) ?? []));
  await Promise.all(drop.map((id) => request((store) => store.delete(id), "readwrite")));
}

export async function deleteSaved(id: string): Promise<void> {
  await request((store) => store.delete(id), "readwrite");
}
