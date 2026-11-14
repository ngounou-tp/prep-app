import type { ReactNode } from "react";

export function StepHeading({ number, id, children, aside }: { number: number; id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 id={id} className="flex items-center gap-2.5 text-base font-bold text-ink sm:text-lg">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs text-on-primary">
          {number}
        </span>
        {children}
      </h3>
      {aside}
    </div>
  );
}
