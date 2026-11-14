import type { SubjectFilter } from "@/lib/client/briefingView";
import type { Subject } from "@/lib/types";
import { Avatar } from "../Avatar";

const CHIP = "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-semibold";

// On a phone the row scrolls sideways inside its own box, never the page.
export function FilterChips({ subjects, filter, onChange }: { subjects: readonly Subject[]; filter: SubjectFilter; onChange: (filter: SubjectFilter) => void }) {
  const chip = (extraClasses: string, pressed: boolean) =>
    `${CHIP} ${pressed ? "border-ink bg-ink text-on-primary" : "border-line-strong bg-surface text-ink hover:bg-ground"} ${extraClasses}`;
  return (
    <div role="group" aria-label="Show developments for" className="-mx-1 overflow-x-auto px-1 py-1" data-print="hide">
      <div className="flex gap-2">
        <button type="button" aria-pressed={filter === "everyone"} onClick={() => onChange("everyone")} className={chip("", filter === "everyone")}>
          Everyone
        </button>
        {subjects.map((subject) => (
          <button
            key={subject.id}
            type="button"
            aria-pressed={filter === subject.id}
            onClick={() => onChange(subject.id)}
            className={chip("pl-2", filter === subject.id)}
          >
            <Avatar subject={subject} size="sm" />
            {subject.name}
          </button>
        ))}
      </div>
    </div>
  );
}
