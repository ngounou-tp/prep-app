"use client";

import { useRef, useState } from "react";
import { citationText } from "@/lib/client/evidence";
import type { Subject, VerifiedClaim } from "@/lib/types";
import { Icon } from "../Icon";
import { CheckSummary, EvidenceChips, EvidenceSource } from "./EvidenceParts";
import { useDialogFocus } from "./useDialogFocus";

type EvidencePanelProps = {
  claim: VerifiedClaim;
  subjects: ReadonlyMap<string, Subject>;
  onClose: () => void;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
};

const SECONDARY = "inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 font-semibold text-ink hover:bg-ground";

export function EvidencePanel({ claim, subjects, onClose, onPrevious, onNext }: EvidencePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onKeyDown = useDialogFocus(panelRef, closeRef, `open-${claim.id}`, onClose);
  const [copyStatus, setCopyStatus] = useState("");
  const copy = () =>
    navigator.clipboard.writeText(citationText(claim)).then(
      () => setCopyStatus("Citation copied"),
      () => setCopyStatus("Could not copy the citation"),
    );
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/50" onClick={onClose} data-print="hide" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
        onKeyDown={onKeyDown}
        data-print="hide"
        className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-surface p-6 shadow-card sm:max-w-[600px] sm:rounded-l-form sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-bold tracking-widest text-accent-text uppercase">Evidence</p>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close evidence" className="flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-ground">
            <Icon name="close" />
          </button>
        </div>
        <h2 id="evidence-title" className="mt-2 font-heading text-[28px] leading-tight font-semibold text-ink">
          {claim.text}
        </h2>
        <EvidenceChips claim={claim} subjects={subjects} />
        <CheckSummary claim={claim} />
        <h3 className="mt-8 font-heading text-xl font-semibold text-ink">
          {claim.sources.length} {claim.sources.length === 1 ? "source" : "sources"}
        </h3>
        <div className="mt-4 space-y-4">
          {claim.sources.map((source) => (
            <EvidenceSource key={source.id} source={source} quote={claim.quote} />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <button type="button" onClick={copy} className={SECONDARY}>
            <Icon name="copy" className="h-4 w-4" />
            Copy citation
          </button>
          {onPrevious === null ? null : (
            <button type="button" onClick={onPrevious} className={SECONDARY}>
              Previous
            </button>
          )}
          {onNext === null ? null : (
            <button type="button" onClick={onNext} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary shadow-card">
              Next development
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          )}
          <span role="status" className="text-sm font-semibold text-verified">
            {copyStatus}
          </span>
        </div>
      </div>
    </>
  );
}
