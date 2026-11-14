"use client";

import { readingSummary } from "@/lib/client/dates";
import { Icon } from "../Icon";

function meetingDistance(days: number): string {
  if (days === 0) {
    return "Your meeting is today.";
  }
  if (days > 0) {
    return `Your meeting is in ${days} ${days === 1 ? "day" : "days"}.`;
  }
  return `Your meeting was ${-days} ${days === -1 ? "day" : "days"} ago.`;
}

export function ReadingNote({ meetingAt, now }: { meetingAt: string | null; now: Date | null }) {
  if (meetingAt === null || now === null) {
    return null;
  }
  const summary = readingSummary(meetingAt, now);
  return (
    <p className="mt-3 flex items-start gap-3 rounded-chip bg-ground p-3 text-sm text-muted" aria-live="polite">
      <Icon name="calendar" className="mt-0.5 h-5 w-5 text-accent-text" />
      <span>
        We will read{" "}
        <strong className="text-ink">
          {summary.from} to {summary.to}
        </strong>
        , {summary.upToToday ? "the 30 days up to today" : "the 30 days before your meeting"}. {meetingDistance(summary.daysUntilMeeting)}
      </span>
    </p>
  );
}
