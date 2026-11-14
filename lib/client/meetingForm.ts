import type { z } from "zod";
import { fieldMessage } from "@/lib/shared/fieldMessages";
import type { BriefingInput } from "@/lib/types";

type MeetingType = BriefingInput["meetingType"];

export const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "sales-call", label: "Sales call" },
  { value: "investor", label: "Investor" },
  { value: "partnership", label: "Partnership" },
  { value: "business-development", label: "Business development" },
  { value: "first-intro", label: "First intro" },
  { value: "other", label: "Other" },
];

// "Other" shows the user's own words, so the page names the meeting the way they did.
export function meetingTypeLabel(input: Pick<BriefingInput, "meetingType" | "meetingTopic">): string {
  if (input.meetingType === "other" && input.meetingTopic !== undefined) {
    return input.meetingTopic;
  }
  return MEETING_TYPES.find((type) => type.value === input.meetingType)?.label ?? input.meetingType;
}

export type FormErrors = { subjects?: string; meetingAt?: string; meetingType?: string; meetingTopic?: string };

// One message per field, in words, explaining what is missing rather than blocking the button.
export function formErrors(issues: readonly z.core.$ZodIssue[], pendingName: string): FormErrors {
  const errors: FormErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field === "subjects" && errors.subjects === undefined) {
      const pending = pendingName.trim();
      errors.subjects = issue.code === "too_small" && pending !== "" ? `Press Add to put ${pending} on the list.` : fieldMessage(issue);
    } else if (field === "meetingAt" && errors.meetingAt === undefined) {
      errors.meetingAt = "Choose the date and time of the meeting.";
    } else if (field === "meetingType" && errors.meetingType === undefined) {
      errors.meetingType = "Choose the kind of meeting.";
    } else if (field === "meetingTopic" && errors.meetingTopic === undefined) {
      errors.meetingTopic = fieldMessage(issue);
    }
  }
  return errors;
}
