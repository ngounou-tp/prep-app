"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../Icon";

// A saved briefing's own address works only on this device, so it shares `shareHref` instead:
// a link that prepares the same briefing afresh.
export function ResultActions({ shareHref }: { shareHref?: string }) {
  const [copyStatus, setCopyStatus] = useState("");
  const copyLink = () => {
    const link = shareHref === undefined ? window.location.href : new URL(shareHref, window.location.origin).href;
    navigator.clipboard.writeText(link).then(
      () => setCopyStatus(shareHref === undefined ? "Link copied" : "Link copied. It prepares this briefing afresh."),
      () => setCopyStatus("Could not copy. Copy the address bar instead."),
    );
  };
  return (
    <>
      <Link href="/" className="flex h-11 items-center rounded-full px-3 font-semibold text-accent-text hover:bg-surface">
        New briefing
      </Link>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-semibold text-ink hover:bg-ground"
        >
          <Icon name="link" className="h-4 w-4" />
          Copy link
        </button>
        <span role="status" className="text-sm font-semibold text-verified">
          {copyStatus}
        </span>
      </span>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary shadow-card"
      >
        <Icon name="download" className="h-4 w-4" />
        Save as PDF
      </button>
    </>
  );
}
