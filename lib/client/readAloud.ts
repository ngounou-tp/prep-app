// The briefing as short passages to read aloud: what to know on the way to the meeting.
// Only the developments on the page and the questions; nothing that could not be verified.
import { developmentDate, developmentsFor, groupLayout, STATUS_LABELS, subjectsById } from "./briefingView";
import { formatDayMonth, formatMeetingTime } from "./dates";
import { meetingTypeLabel } from "./meetingForm";
import type { BriefingResult } from "@/lib/types";
import { questionSets } from "./questions";

const WORDS_PER_MINUTE = 160;

function developmentPassages(briefing: BriefingResult): string[] {
  const subjects = subjectsById(briefing);
  return groupLayout(briefing).flatMap(({ subjectId }) => {
    const developments = developmentsFor(briefing, subjectId, false);
    const name = subjects.get(subjectId)?.name ?? "";
    if (developments.length === 0) {
      return [];
    }
    const lines = developments.map(({ claim }) => {
      const date = developmentDate(claim);
      return `${date === null ? "" : `On ${formatDayMonth(date)}: `}${claim.text} ${STATUS_LABELS[claim.status]}.`;
    });
    return [`${name}.`, ...lines];
  });
}

export function readAloudPassages(briefing: BriefingResult): string[] {
  const subjects = subjectsById(briefing);
  const { meetingType, meetingTopic } = briefing.input;
  const meeting = meetingType === "other" ? `meeting about ${meetingTopic ?? "this topic"}` : meetingTypeLabel(briefing.input).toLowerCase();
  const opening = `Briefing for your ${meeting} on ${formatMeetingTime(briefing.input.meetingAt)}.`;
  const questions = questionSets(briefing).first.map((question, index) => {
    const about = question.subjectIds.map((id) => subjects.get(id)?.name ?? "").join(" and ");
    return `Question ${index + 1}, for ${about}: ${question.text}`;
  });
  return [
    opening,
    ...(briefing.snapshot === null ? [] : [briefing.snapshot]),
    ...developmentPassages(briefing),
    ...(questions.length === 0 ? [] : ["Questions to ask.", ...questions]),
  ];
}

export function listeningMinutes(passages: readonly string[]): number {
  const words = passages.join(" ").split(/\s+/).filter((word) => word !== "").length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
