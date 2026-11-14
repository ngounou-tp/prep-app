"use client";

import { useState, type DragEvent } from "react";
import { parseInvite, type InviteDetails } from "@/lib/client/calendarInvite";

// Real invites are a few kilobytes; anything far larger is not one.
const MAX_INVITE_BYTES = 512 * 1024;

function describeImport(invite: InviteDetails): string {
  const title = invite.title === null ? "" : ` “${invite.title}”`;
  const time = invite.meetingAt === null ? "It has no time; set it below." : invite.allDay ? "It is an all-day event, so the time is set to 09:00." : "The time is set from it.";
  const found = invite.people.length + invite.companies.length;
  return `Imported${title}. ${time} ${found === 0 ? "" : `${found} suggestions to add are listed below.`}`.trim();
}

// Reads a picked or dropped .ics file in the browser. Nothing is uploaded.
export function useInviteImport(onImported: (invite: InviteDetails) => void) {
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  const read = (file: File) => {
    if (file.size > MAX_INVITE_BYTES) {
      setStatus("That file is too large to be a calendar invite.");
      return;
    }
    file.text().then(
      (text) => {
        const details = parseInvite(text);
        if (details.meetingAt === null && details.people.length === 0) {
          setStatus("No meeting found in that file. Export the invite as an .ics file and try again.");
          return;
        }
        setInvite(details);
        onImported(details);
        setStatus(describeImport(details));
      },
      () => setStatus("That file could not be read."),
    );
  };

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
        setDragging(true);
      }
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file !== undefined) {
        read(file);
      }
    },
  };
  return { invite, status, dragging, read, dropHandlers };
}
