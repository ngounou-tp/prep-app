"use client";

import type { RefObject } from "react";
import type { InviteDetails } from "@/lib/client/calendarInvite";
import { MAX_SUBJECTS, companySuggestions } from "@/lib/client/subjectList";
import { FieldError } from "../FieldError";
import { AddSubjectArea } from "./AddSubjectArea";
import { InviteSuggestions } from "./InviteImport";
import { MeetingTypeChips } from "./MeetingTypeChips";
import { ReadingNote } from "./ReadingNote";
import { StepHeading } from "./StepHeading";
import { SubjectRows } from "./SubjectRows";
import type { MeetingFields } from "./useMeetingFields";
import type { useSubjectList } from "./useSubjectList";

type SubjectList = ReturnType<typeof useSubjectList>;
type InputRef = RefObject<HTMLInputElement | null>;

const STEP = "border-t border-line pt-5 first:border-t-0 first:pt-0";

export function WhenStep({ meeting, inputRef, error }: { meeting: MeetingFields; inputRef: InputRef; error: string | undefined }) {
  return (
    <section aria-labelledby="step-when" className={STEP}>
      <StepHeading number={1} id="step-when">
        When is the meeting?
      </StepHeading>
      <label htmlFor="meeting-at" className="sr-only">
        Meeting date and time
      </label>
      <input
        ref={inputRef}
        id="meeting-at"
        type="datetime-local"
        value={meeting.value}
        onChange={(event) => meeting.change(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : "meeting-at-error"}
        className="mt-3 h-12 w-full rounded-input border border-line-strong bg-surface px-4 text-base text-ink"
      />
      <FieldError id="meeting-at-error" message={error} />
      <ReadingNote meetingAt={meeting.iso} now={meeting.now} />
    </section>
  );
}

export function KindStep({ meeting, topicError }: { meeting: MeetingFields; topicError: string | undefined }) {
  return (
    <section aria-labelledby="step-kind" className={STEP}>
      <StepHeading number={2} id="step-kind">
        What kind of meeting?
      </StepHeading>
      <MeetingTypeChips value={meeting.type} onChange={meeting.setType} topic={meeting.topic} onTopicChange={meeting.setTopic} topicError={topicError} labelledBy="step-kind" />
    </section>
  );
}

// At five the add fields give way to an explanation instead of a disabled button.
export function SubjectsStep({ list, nameRef, error, invite }: { list: SubjectList; nameRef: InputRef; error: string | undefined; invite: InviteDetails | null }) {
  const full = list.subjects.length >= MAX_SUBJECTS;
  return (
    <section aria-labelledby="step-subjects" className={STEP}>
      <StepHeading number={3} id="step-subjects" aside={<span className="shrink-0 text-sm font-bold text-muted">{`${list.subjects.length} of ${MAX_SUBJECTS}`}</span>}>
        Who will be there?
      </StepHeading>
      <SubjectRows subjects={list.subjects} onRemove={list.remove} />
      {full ? (
        <p className="mt-3 rounded-card border-2 border-dashed border-line-strong p-3 text-sm text-muted">
          You have added 5 people and companies, the most one briefing covers. Remove one to add someone else.
        </p>
      ) : (
        <>
          <InviteSuggestions invite={invite} subjects={list.subjects} onPick={list.prepare} />
          <AddSubjectArea
            draft={list.draft}
            onChange={list.changeDraft}
            onAdd={list.add}
            error={list.draftError}
            suggestions={companySuggestions(list.subjects)}
            nameRef={nameRef}
            describedBy={error === undefined ? undefined : "subjects-error"}
          />
        </>
      )}
      <FieldError id="subjects-error" message={error} />
    </section>
  );
}
