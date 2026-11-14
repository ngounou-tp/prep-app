"use client";

import type { KeyboardEvent, RefObject } from "react";
import type { SubjectDraft } from "@/lib/client/subjectList";
import { FieldError } from "../FieldError";
import { Icon } from "../Icon";

type DraftError = { field: "name" | "company"; message: string } | null;

type AddSubjectAreaProps = {
  draft: SubjectDraft;
  onChange: (draft: SubjectDraft) => void;
  onAdd: () => void;
  error: DraftError;
  suggestions: readonly string[];
  nameRef: RefObject<HTMLInputElement | null>;
  describedBy?: string;
};

const LABEL = "mb-1 block text-sm font-semibold text-ink";
const INPUT = "h-12 w-full rounded-input border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-muted";

function describedByIds(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter((id) => id !== undefined && id !== "").join(" ");
  return joined === "" ? undefined : joined;
}

// Enter in either text field adds, like the button, so the form is never submitted half-filled.
function addOnEnter(onAdd: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onAdd();
    }
  };
}

export function AddSubjectArea({ draft, onChange, onAdd, error, suggestions, nameRef, describedBy }: AddSubjectAreaProps) {
  const nameError = error?.field === "name" ? error.message : undefined;
  const companyError = error?.field === "company" ? error.message : undefined;
  return (
    <div className="mt-3 rounded-card border-2 border-dashed border-line-strong p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <div>
          <label htmlFor="subject-name" className={LABEL}>
            Name
          </label>
          <input
            ref={nameRef}
            id="subject-name"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            onKeyDown={addOnEnter(onAdd)}
            placeholder="Company or person"
            autoComplete="off"
            maxLength={120}
            aria-invalid={nameError !== undefined}
            aria-describedby={describedByIds(nameError === undefined ? undefined : "subject-name-error", describedBy)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="subject-type" className={LABEL}>
            Type
          </label>
          <select
            id="subject-type"
            value={draft.type}
            onChange={(event) => onChange({ ...draft, type: event.target.value === "person" ? "person" : "company" })}
            className={`${INPUT} px-3`}
          >
            <option value="company">Company</option>
            <option value="person">Person</option>
          </select>
        </div>
      </div>
      <FieldError id="subject-name-error" message={nameError} />
      <div className="mt-2 flex items-end gap-2">
        {draft.type === "person" ? (
          <CompanyField draft={draft} onChange={onChange} onAdd={onAdd} message={companyError} suggestions={suggestions} />
        ) : (
          <p className="min-w-0 flex-1 self-center text-sm text-muted">Press Enter or Add. Up to 5 in one briefing.</p>
        )}
        <button type="button" onClick={onAdd} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-chip bg-ink px-5 font-bold text-on-primary">
          <Icon name="plus" />
          Add
        </button>
      </div>
      <FieldError id="subject-company-error" message={companyError} />
    </div>
  );
}

type CompanyFieldProps = Pick<AddSubjectAreaProps, "draft" | "onChange" | "onAdd" | "suggestions"> & { message: string | undefined };

function CompanyField({ draft, onChange, onAdd, message, suggestions }: CompanyFieldProps) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor="subject-company" className={LABEL}>
        Their company, optional
      </label>
      <input
        id="subject-company"
        value={draft.company}
        onChange={(event) => onChange({ ...draft, company: event.target.value })}
        onKeyDown={addOnEnter(onAdd)}
        placeholder="Helps find the right person"
        list="known-companies"
        autoComplete="off"
        maxLength={200}
        aria-invalid={message !== undefined}
        aria-describedby={message === undefined ? undefined : "subject-company-error"}
        className={INPUT}
      />
      <datalist id="known-companies">
        {suggestions.map((company) => (
          <option key={company} value={company} />
        ))}
      </datalist>
    </div>
  );
}
