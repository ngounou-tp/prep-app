"use client";

import { useEffect, useRef, useState } from "react";
import { putSaved, savedBriefingsAvailable } from "@/lib/client/savedBriefings";
import type { BriefingResult } from "@/lib/types";

export type SaveState = "idle" | "saved" | "failed";

// Later changes (a subject retried) update the same entry rather than saving a second copy.
export function useSavedBriefing(briefing: BriefingResult | null, existingId: string | null = null): SaveState {
  const idRef = useRef<string | null>(existingId);
  const lastSavedRef = useRef<BriefingResult | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  useEffect(() => {
    // Returning to the page re-runs this effect; saving again would only reorder "Your briefings".
    if (briefing === null || briefing === lastSavedRef.current || !savedBriefingsAvailable()) {
      return;
    }
    lastSavedRef.current = briefing;
    idRef.current ??= crypto.randomUUID();
    putSaved({ id: idRef.current, savedAt: new Date().toISOString(), briefing }).then(
      () => setState("saved"),
      () => setState("failed"),
    );
  }, [briefing]);
  return state;
}

export function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span role="status" className="text-sm font-semibold text-muted">
      {state === "saved" ? "Saved on this device" : state === "failed" ? "Could not save on this device" : ""}
    </span>
  );
}
