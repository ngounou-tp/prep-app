// Date formatting for the page. intlFormat formats in the user's own locale; window dates are
// calendar days, parsed as local dates so "12 Oct" stays 12 Oct in every timezone.
import { differenceInCalendarDays, format, intlFormat, isValid, parseISO } from "date-fns";
import { researchWindow } from "@/lib/research/window";

export function formatDayMonth(isoDate: string): string {
  return intlFormat(parseISO(isoDate), { day: "numeric", month: "short" });
}

export function formatFullDate(isoDate: string): string {
  return intlFormat(parseISO(isoDate), { day: "numeric", month: "short", year: "numeric" });
}

export function dayTile(isoDate: string): { day: string; month: string } {
  const date = parseISO(isoDate);
  return { day: intlFormat(date, { day: "2-digit" }), month: intlFormat(date, { month: "short" }) };
}

export function formatMeetingTime(isoDateTime: string): string {
  return intlFormat(parseISO(isoDateTime), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A datetime-local value ("2026-11-19T10:00") is local time; the API wants an ISO instant.
export function localInputToIso(value: string): string | null {
  const date = new Date(value);
  return value === "" || !isValid(date) ? null : date.toISOString();
}

export function isoToLocalInput(isoDateTime: string): string {
  const date = parseISO(isoDateTime);
  return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

export type ReadingSummary = { from: string; to: string; upToToday: boolean; daysUntilMeeting: number };

// What the form tells the user before they submit: which 30 days will be read.
export function readingSummary(meetingAt: string, now: Date): ReadingSummary {
  const window = researchWindow(meetingAt, now);
  const meeting = parseISO(meetingAt);
  return {
    from: formatDayMonth(window.startDate),
    to: formatDayMonth(format(window.end, "yyyy-MM-dd")),
    upToToday: meeting.getTime() > now.getTime(),
    daysUntilMeeting: differenceInCalendarDays(meeting, now),
  };
}
