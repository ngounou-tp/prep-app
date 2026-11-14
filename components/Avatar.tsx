import type { Subject } from "@/lib/types";
import { Icon } from "./Icon";

type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-lg",
};

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => word !== "")
    .map((word) => Array.from(word)[0] ?? "");
  return letters.slice(0, 2).join("").toUpperCase();
}

type AvatarProps = {
  subject: Pick<Subject, "name" | "type">;
  size?: AvatarSize;
  // "icon" is the landing list's look: a building or a person on a soft tile.
  variant?: "initials" | "icon";
  faded?: boolean;
  className?: string;
};

// Decorative: the subject's name is always written next to it.
export function Avatar({ subject, size = "md", variant = "initials", faded = false, className = "" }: AvatarProps) {
  const company = subject.type === "company";
  if (variant === "icon") {
    const tone = company ? "bg-blush text-accent-text" : "bg-single-surface text-single";
    const shape = company ? "rounded-[8px]" : "rounded-full";
    return (
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${size === "sm" ? shape : "rounded-tile"} ${tone} ${SIZES[size]} ${className}`}>
        <Icon name={company ? "building" : "person"} className={size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"} />
      </span>
    );
  }
  const shape = company ? "rounded-tile bg-primary text-on-primary" : "rounded-full bg-single-surface text-single";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-bold ${shape} ${SIZES[size]} ${faded ? "opacity-40" : ""} ${className}`}
    >
      {initials(subject.name)}
    </span>
  );
}

export function AvatarStack({ subjects, fadedIds = [] }: { subjects: readonly Subject[]; fadedIds?: readonly string[] }) {
  return (
    <div className="flex items-center">
      <span className="sr-only">{subjects.map((subject) => subject.name).join(", ")}</span>
      {subjects.map((subject, index) => (
        <Avatar
          key={subject.id}
          subject={subject}
          size="lg"
          faded={fadedIds.includes(subject.id)}
          className={`ring-4 ring-surface ${index === 0 ? "" : "-ml-3"}`}
        />
      ))}
    </div>
  );
}
