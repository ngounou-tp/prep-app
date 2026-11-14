import { addMilliseconds, isValid, min, parseISO } from "date-fns";
import { millisecondsInDay } from "date-fns/constants";
import type { ResearchWindow } from "@/lib/types";

const WINDOW_LENGTH_IN_DAYS = 30;

// Whole 24-hour steps rather than calendar days, so the window is identical whatever
// timezone the server runs in; all dates are then read in UTC.
function shiftDays(date: Date, days: number): Date {
  return addMilliseconds(date, days * millisecondsInDay);
}

export function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function researchWindow(meetingAt: string, now: Date): ResearchWindow {
  const meeting = parseISO(meetingAt);
  if (!isValid(meeting)) {
    throw new RangeError("meetingAt must be an ISO 8601 date-time");
  }
  const end = min([meeting, now]);
  const start = shiftDays(end, -WINDOW_LENGTH_IN_DAYS);
  return {
    start,
    end,
    startDate: toUtcDateString(start),
    endDate: toUtcDateString(shiftDays(end, 1)),
  };
}
