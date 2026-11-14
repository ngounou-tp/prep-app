"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { briefingSearchParams } from "@/lib/client/briefingLink";
import { formErrors, type FormErrors } from "@/lib/client/meetingForm";
import { requestGatewayWake } from "@/lib/client/wakeGateway";
import { briefingInputSchema, type BriefingInput } from "@/lib/types";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { useFreshKey } from "../useFreshKey";
import { KindStep, SubjectsStep, WhenStep } from "./FormSteps";
import { InviteButton } from "./InviteImport";
import { useInviteImport } from "./useInviteImport";
import { useMeetingFields } from "./useMeetingFields";
import { useSubjectList } from "./useSubjectList";

// The button is never disabled: on submit the shared schema checks everything and each problem
// is explained next to its field.
type BriefingFormProps = { initialInput: BriefingInput | null; notice: string | null };

export function BriefingForm({ initialInput, notice }: BriefingFormProps) {
  const prefilled = initialInput === null ? "" : briefingSearchParams(initialInput).toString();
  const key = useFreshKey(`${prefilled}|${notice ?? ""}`);
  return <Form key={key} initialInput={initialInput} notice={notice} />;
}

function Form({ initialInput, notice }: BriefingFormProps) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const meetingInputRef = useRef<HTMLInputElement>(null);
  const list = useSubjectList(initialInput?.subjects ?? [], nameRef);
  const meeting = useMeetingFields(initialInput);
  const invite = useInviteImport((details) => meeting.fillFromInvite(details.meetingAt, details.title));
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => {
    void requestGatewayWake();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = { meetingAt: meeting.iso ?? "", meetingType: meeting.type, meetingTopic: meeting.meetingTopic, subjects: list.subjects };
    const parsed = briefingInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const found = formErrors(parsed.error.issues, list.draft.name);
      setErrors(found);
      (found.meetingAt === undefined && found.subjects !== undefined ? nameRef.current : meetingInputRef.current)?.focus();
      return;
    }
    router.push(`/briefing?${briefingSearchParams(parsed.data)}`);
  };

  const shown = {
    subjects: list.subjects.length === 0 ? errors.subjects : undefined,
    meetingAt: meeting.iso === null ? errors.meetingAt : undefined,
    meetingTopic: meeting.type === "other" && meeting.meetingTopic === undefined ? errors.meetingTopic : undefined,
  };
  return (
    <Card large className={`relative p-5 sm:p-7 ${invite.dragging ? "ring-4 ring-sun" : ""}`} {...invite.dropHandlers}>
      <form onSubmit={submit} noValidate aria-labelledby="new-briefing-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="new-briefing-title" className="font-heading text-[28px] font-semibold text-ink">
            New briefing
          </h2>
          <div className="flex items-center gap-3">
            <p className="hidden items-center gap-1.5 text-sm font-semibold text-muted sm:flex">
              <Icon name="clock" className="h-4 w-4" />
              Under a minute
            </p>
            <InviteButton onFile={invite.read} />
          </div>
        </div>
        <p role="status" className="mt-1 text-sm text-muted">
          {invite.status === "" ? "Tip: drop a calendar invite (.ics) here to fill it in. It stays on your device." : invite.status}
        </p>
        {notice === null ? null : <p className="mt-3 rounded-chip bg-single-surface p-3 font-semibold text-single">{notice}</p>}
        <div className="mt-5 flex flex-col gap-5">
          <WhenStep meeting={meeting} inputRef={meetingInputRef} error={shown.meetingAt} />
          <KindStep meeting={meeting} topicError={shown.meetingTopic} />
          <SubjectsStep list={list} nameRef={nameRef} error={shown.subjects} invite={invite.invite} />
        </div>
        <button
          type="submit"
          className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-chip bg-primary text-lg font-bold text-on-primary shadow-card hover:brightness-95"
        >
          Prepare my briefing
          <Icon name="arrowRight" />
        </button>
        <p aria-live="polite" className="sr-only">
          {list.announcement}
        </p>
      </form>
    </Card>
  );
}
