"use client";

import { useSyncExternalStore } from "react";

const PATTERN = /^#claim-(C\d+)$/;

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

// The open evidence panel lives in the URL hash (#claim-C3), so a link can open it directly
// and the browser's Back button closes it.
export function useClaimHash() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const openId = PATTERN.exec(hash)?.[1] ?? null;
  const open = (claimId: string) => {
    window.location.hash = `claim-${claimId}`;
  };
  const close = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return { openId, open, close };
}
