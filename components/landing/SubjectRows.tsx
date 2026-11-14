"use client";

import type { Subject } from "@/lib/types";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";

function secondPart(subject: Subject): string {
  if (subject.type === "company") {
    return "Company";
  }
  return subject.company ?? "Person";
}

export function SubjectRows({ subjects, onRemove }: { subjects: readonly Subject[]; onRemove: (id: string) => void }) {
  if (subjects.length === 0) {
    return null;
  }
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {subjects.map((subject) => (
        <li key={subject.id} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-ground pl-2">
          <Avatar subject={subject} variant="icon" size="sm" />
          <span className="min-w-0 truncate text-sm">
            <span className="font-bold text-ink">{subject.name}</span>
            <span className="text-muted"> · {secondPart(subject)}</span>
          </span>
          <button
            type="button"
            id={`remove-${subject.id}`}
            onClick={() => onRemove(subject.id)}
            aria-label={`Remove ${subject.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-blush hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
