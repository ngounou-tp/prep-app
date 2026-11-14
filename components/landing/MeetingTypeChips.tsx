"use client";

import { MEETING_TYPES } from "@/lib/client/meetingForm";
import { MEETING_TOPIC_MAX_LENGTH, type BriefingInput } from "@/lib/types";
import { FieldError } from "../FieldError";

type MeetingType = BriefingInput["meetingType"];

type MeetingTypeChipsProps = {
  value: MeetingType;
  onChange: (value: MeetingType) => void;
  topic: string;
  onTopicChange: (topic: string) => void;
  topicError: string | undefined;
  labelledBy: string;
};

// One line from tablet width up; a phone is too narrow for six chips, so they form two even columns.
export function MeetingTypeChips({ value, onChange, topic, onTopicChange, topicError, labelledBy }: MeetingTypeChipsProps) {
  return (
    <div className="mt-3">
      <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 md:flex">
        {MEETING_TYPES.map((type) => {
          const pressed = type.value === value;
          return (
            <button
              key={type.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(type.value)}
              className={`min-h-11 rounded-full border px-3 text-sm leading-tight font-bold md:flex-auto md:whitespace-nowrap ${pressed ? "border-ink bg-ink text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-ground"}`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
      {value === "other" ? (
        <div className="mt-2">
          <label htmlFor="meeting-topic" className="sr-only">
            What is the meeting about?
          </label>
          <input
            id="meeting-topic"
            value={topic}
            onChange={(event) => onTopicChange(event.target.value)}
            placeholder="What is the meeting about? For example: hackathon judging"
            maxLength={MEETING_TOPIC_MAX_LENGTH}
            autoComplete="off"
            aria-invalid={topicError !== undefined}
            aria-describedby={topicError === undefined ? undefined : "meeting-topic-error"}
            className="h-12 w-full rounded-input border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-muted"
          />
          <FieldError id="meeting-topic-error" message={topicError} />
        </div>
      ) : null}
    </div>
  );
}
