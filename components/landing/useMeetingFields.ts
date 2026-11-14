"use client";

import { useState, useSyncExternalStore } from "react";
import { isoToLocalInput, localInputToIso } from "@/lib/client/dates";
import type { BriefingInput } from "@/lib/types";

const subscribeToNothing = () => () => undefined;

// "Now" exists only in the browser: the page is prerendered, and a server time there would be
// stale. The same Date is returned on every read, as useSyncExternalStore requires.
let pageOpenedAt: Date | null = null;
const readPageOpenedAt = () => (pageOpenedAt ??= new Date());

// The meeting time, kind and, for "Other", its topic. A prefilled time (from "Edit and try
// again") becomes local time only after hydration, so server and browser render the same.
export function useMeetingFields(initialInput: BriefingInput | null) {
  const openedAt = useSyncExternalStore(subscribeToNothing, readPageOpenedAt, () => null);
  const [edited, setEdited] = useState<string | null>(null);
  const [type, setType] = useState<BriefingInput["meetingType"]>(initialInput?.meetingType ?? "sales-call");
  const [topic, setTopic] = useState(initialInput?.meetingTopic ?? "");
  const [changedAt, setChangedAt] = useState<Date | null>(null);
  const value = edited ?? (openedAt !== null && initialInput !== null ? isoToLocalInput(initialInput.meetingAt) : "");
  const change = (next: string) => {
    setEdited(next);
    setChangedAt(new Date());
  };
  const fillFromInvite = (meetingAt: string | null, title: string | null) => {
    if (meetingAt !== null) {
      change(isoToLocalInput(meetingAt));
    }
    if (title !== null && topic.trim() === "") {
      setTopic(title);
    }
  };
  const meetingTopic = type === "other" && topic.trim() !== "" ? topic.trim() : undefined;
  return { value, iso: localInputToIso(value), change, type, setType, topic, setTopic, meetingTopic, fillFromInvite, now: changedAt ?? openedAt };
}

export type MeetingFields = ReturnType<typeof useMeetingFields>;
