import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="relative z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 sm:py-6 print:hidden">
      <Link href="/" className="rounded-tile" aria-label="Foreword, start a new briefing">
        <Wordmark />
      </Link>
      {children === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3" data-print="hide">
          {children}
        </div>
      )}
    </header>
  );
}
