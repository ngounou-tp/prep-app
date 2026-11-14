"use client";

import { useRouter } from "next/navigation";

// Visited pages stay mounted but hidden (cacheComponents uses React Activity), so a page would
// otherwise reopen with its old state. Used as a key, this starts the page afresh on every link
// click or router.push, and for every new request, while Back and Forward still restore it.
export function useFreshKey(request: string): string {
  const { bfcacheId } = useRouter();
  return `${bfcacheId}|${request}`;
}
