"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { addSubject, nextSubjectId, removeSubject, type SubjectDraft } from "@/lib/client/subjectList";
import type { Subject } from "@/lib/types";

const EMPTY_DRAFT: SubjectDraft = { name: "", type: "company", company: "" };

type DraftError = { field: "name" | "company"; message: string } | null;

// Focus moves after the render that changed the list, once the target element exists.
// "name" means the name field; anything else is an element id.
function useFocusAfterRender(nameRef: RefObject<HTMLInputElement | null>) {
  const pendingFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target !== null) {
      (target === "name" ? nameRef.current : document.getElementById(target))?.focus();
    }
  });
  return pendingFocusRef;
}

export function useSubjectList(initial: readonly Subject[], nameRef: RefObject<HTMLInputElement | null>) {
  const [subjects, setSubjects] = useState<Subject[]>([...initial]);
  const [draft, setDraft] = useState<SubjectDraft>(EMPTY_DRAFT);
  const [draftError, setDraftError] = useState<DraftError>(null);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocusRef = useFocusAfterRender(nameRef);

  const add = () => {
    const result = addSubject(subjects, draft, nextSubjectId(subjects));
    if (!result.ok) {
      setDraftError({ field: result.field, message: result.message });
      pendingFocusRef.current = result.field === "name" ? "name" : "subject-company";
      return;
    }
    setSubjects(result.subjects);
    setDraft({ ...EMPTY_DRAFT, type: draft.type });
    setDraftError(null);
    setAnnouncement(`Added ${result.added.name}. ${result.subjects.length} of 5.`);
    pendingFocusRef.current = "name";
  };

  const remove = (id: string) => {
    const removed = subjects.find((subject) => subject.id === id);
    const result = removeSubject(subjects, id);
    setSubjects(result.subjects);
    setAnnouncement(`Removed ${removed?.name ?? "the subject"}. ${result.subjects.length} of 5.`);
    pendingFocusRef.current = result.focusId === null ? "name" : `remove-${result.focusId}`;
  };

  const changeDraft = (next: SubjectDraft) => {
    setDraft(next);
    setDraftError(null);
  };

  // A suggestion from a calendar invite fills the add row for checking; it is never added unseen.
  const prepare = (next: SubjectDraft) => {
    changeDraft(next);
    setAnnouncement(`${next.name} is ready to add. Check the name, then press Add.`);
    pendingFocusRef.current = "name";
  };

  return { subjects, draft, draftError, announcement, add, remove, changeDraft, prepare, announce: setAnnouncement };
}
