import type { ReactNode } from "react";
import { formatDayMonth, formatMeetingTime } from "@/lib/client/dates";
import { meetingTypeLabel } from "@/lib/client/meetingForm";
import type { BriefingResult } from "@/lib/types";
import { AvatarStack } from "../Avatar";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { ListenButton } from "./ListenButton";

function MetaChip({ children }: { children: ReactNode }) {
  return <li className="inline-flex items-center gap-2 rounded-full border border-line bg-ground px-3 py-1.5 text-sm font-semibold text-ink">{children}</li>;
}

export function MeetingCard({ briefing, fadedIds }: { briefing: BriefingResult; fadedIds: readonly string[] }) {
  const type = meetingTypeLabel(briefing.input);
  return (
    <Card aria-labelledby="briefing-title" className="p-5 sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <AvatarStack subjects={briefing.input.subjects} fadedIds={fadedIds} />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-widest text-accent-text uppercase">Briefing · {type}</p>
          <h1 id="briefing-title" className="mt-1 font-heading text-[32px] leading-tight font-semibold text-ink sm:text-[44px]">
            Your meeting, in one page
          </h1>
          <ul className="mt-4 flex flex-wrap gap-2">
            <MetaChip>
              <Icon name="calendar" className="h-4 w-4" />
              {formatMeetingTime(briefing.input.meetingAt)}
            </MetaChip>
            <MetaChip>{type}</MetaChip>
            <MetaChip>
              Read {formatDayMonth(briefing.window.startDate)} to {formatDayMonth(briefing.window.lastDate)}
            </MetaChip>
            <MetaChip>
              {briefing.research.sourcesFound} {briefing.research.sourcesFound === 1 ? "source" : "sources"}
            </MetaChip>
          </ul>
          <div className="mt-4">
            <ListenButton briefing={briefing} />
          </div>
        </div>
      </div>
    </Card>
  );
}
