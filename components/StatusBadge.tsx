import type { ClaimStatus } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

// Never colour alone: every status has its own icon and label (CLAUDE.md).
const STATUS: Record<ClaimStatus, { label: string; icon: IconName; tone: string }> = {
  verified: { label: "Verified", icon: "checkCircle", tone: "bg-verified-surface text-verified" },
  "single-source": { label: "Single source", icon: "link", tone: "bg-single-surface text-single" },
  unconfirmed: { label: "Could not verify", icon: "question", tone: "bg-unconfirmed-surface text-unconfirmed" },
};

const SIZES = {
  md: { scale: "gap-1.5 px-3 py-1 text-sm", icon: "h-4 w-4" },
  lg: { scale: "gap-1.5 px-4 py-2 text-base", icon: "h-4 w-4" },
  print: { scale: "gap-[2pt] px-[4pt] py-[0.5pt] text-[7.5pt]", icon: "h-[8pt] w-[8pt]" },
};

export function StatusBadge({ status, size = "md" }: { status: ClaimStatus; size?: keyof typeof SIZES }) {
  const { label, icon, tone } = STATUS[status];
  const { scale, icon: iconSize } = SIZES[size];
  return (
    <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${tone} ${scale}`}>
      <Icon name={icon} className={iconSize} />
      {label}
    </span>
  );
}
