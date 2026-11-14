"use client";

import { normaliseName, type Subject } from "@/lib/types";
import type { InviteDetails, InvitePerson } from "@/lib/client/calendarInvite";
import type { SubjectDraft } from "@/lib/client/subjectList";
import { Icon } from "../Icon";

export function InviteButton({ onFile }: { onFile: (file: File) => void }) {
  return (
    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-ground has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-solid">
      <Icon name="calendar" className="h-4 w-4" />
      Import invite
      <input
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            onFile(file);
          }
          event.target.value = "";
        }}
      />
    </label>
  );
}

type Suggestion = { key: string; label: string; draft: SubjectDraft };

function suggestionsFrom(invite: InviteDetails, subjects: readonly Subject[]): Suggestion[] {
  const listed = new Set(subjects.map((subject) => `${subject.type}:${normaliseName(subject.name)}`));
  const people = invite.people.map((person: InvitePerson) => ({
    key: `person:${normaliseName(person.name)}`,
    label: person.company === null ? person.name : `${person.name} · ${person.company}`,
    draft: { name: person.name, type: "person" as const, company: person.company ?? "" },
  }));
  const companies = invite.companies.map((company) => ({
    key: `company:${normaliseName(company)}`,
    label: company,
    draft: { name: company, type: "company" as const, company: "" },
  }));
  return [...companies, ...people].filter((suggestion) => !listed.has(suggestion.key));
}

export function InviteSuggestions({ invite, subjects, onPick }: { invite: InviteDetails | null; subjects: readonly Subject[]; onPick: (draft: SubjectDraft) => void }) {
  const suggestions = invite === null ? [] : suggestionsFrom(invite, subjects);
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-muted">From your invite. Pick one, check it, then press Add:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.key}>
            <button
              type="button"
              onClick={() => onPick(suggestion.draft)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-ground"
            >
              <Icon name="plus" className="h-4 w-4" />
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
