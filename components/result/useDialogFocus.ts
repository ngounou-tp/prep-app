"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(panelRef: RefObject<HTMLElement | null>, startRef: RefObject<HTMLElement | null>, returnToId: string, onClose: () => void) {
  useEffect(() => {
    startRef.current?.focus();
    return () => document.getElementById(returnToId)?.focus();
  }, [startRef, returnToId]);

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || panelRef.current === null) {
      return;
    }
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
