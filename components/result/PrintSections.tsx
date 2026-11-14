import { developmentDate, developmentsFor, groupLayout } from "@/lib/client/briefingView";
import { formatDayMonth } from "@/lib/client/dates";
import type { QuestionSets } from "@/lib/client/questions";
import type { BriefingResult, Source, Subject, VerifiedClaim } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";

export type Group = { subjectId: string; line: string | null; rows: VerifiedClaim[] };
type Subjects = ReadonlyMap<string, Subject>;

// Paper has room for this many questions tied to findings.
const PRINTED_QUESTIONS = 6;

export function subjectLabel(subject: Subject | undefined): string {
  if (subject === undefined) {
    return "";
  }
  return subject.type === "person" && subject.company !== undefined ? `${subject.name} · ${subject.company}` : subject.name;
}

// Each claim has one home subject, so no development repeats across groups.
export function shownGroups(briefing: BriefingResult): Group[] {
  return groupLayout(briefing)
    .map(({ subjectId }) => ({
      subjectId,
      line: briefing.subjects.find((section) => section.subjectId === subjectId)?.line ?? null,
      rows: developmentsFor(briefing, subjectId, false).map(({ claim }) => claim),
    }))
    .filter((group) => group.rows.length > 0);
}

export function PrintHeading({ children }: { children: string }) {
  return <h2 className="mt-[7pt] mb-[3pt] font-heading text-[11pt] font-semibold text-ink">{children}</h2>;
}

function DevelopmentRow({ claim, homeId, subjects }: { claim: VerifiedClaim; homeId: string; subjects: Subjects }) {
  const date = developmentDate(claim);
  const others = claim.subjectIds.filter((id) => id !== homeId).map((id) => subjects.get(id)?.name ?? "");
  return (
    <tr className="break-inside-avoid border-b border-line align-top">
      <td className="w-[10%] py-[2.5pt] pr-[4pt] pl-[5pt] font-bold whitespace-nowrap text-accent-text">{date === null ? "Undated" : formatDayMonth(date)}</td>
      <td className="py-[2.5pt] pr-[6pt] text-ink">
        {claim.text}
        {others.length === 0 ? null : <span className="text-[8pt] text-muted"> Also about {others.join(", ")}.</span>}
      </td>
      <td className="w-[15%] py-[2.5pt] pr-[5pt] text-right">
        <StatusBadge status={claim.status} size="print" />
        <span className="mt-[1pt] block text-[7pt] text-muted">{claim.sourceIds.join(", ")}</span>
      </td>
    </tr>
  );
}

export function PrintDevelopments({ groups, subjects }: { groups: Group[]; subjects: Subjects }) {
  return (
    <table className="w-full border-collapse text-left text-[9pt] leading-[1.3]">
      {groups.map((group) => (
        <tbody key={group.subjectId} className="break-inside-avoid">
          <tr>
            <th colSpan={3} scope="colgroup" className="max-w-0 truncate rounded-[4pt] bg-ground px-[5pt] py-[2pt] text-left font-normal">
              <strong className="text-ink">{subjectLabel(subjects.get(group.subjectId))}</strong>
              {group.line === null ? null : <span className="text-[8.5pt] text-muted"> · {group.line}</span>}
            </th>
          </tr>
          {group.rows.map((claim) => (
            <DevelopmentRow key={claim.id} claim={claim} homeId={group.subjectId} subjects={subjects} />
          ))}
        </tbody>
      ))}
    </table>
  );
}

function TickBox() {
  return <span aria-hidden="true" className="mt-[1.5pt] h-[7pt] w-[7pt] shrink-0 rounded-[1.5pt] border border-line-strong" />;
}

// A box to take into the room: each question with a square to tick once it has been asked.
export function PrintQuestions({ sets, subjects }: { sets: QuestionSets; subjects: Subjects }) {
  const tied = [...sets.first, ...sets.more].slice(0, PRINTED_QUESTIONS);
  if (tied.length === 0 && sets.beyond.length === 0) {
    return null;
  }
  return (
    <section className="mt-[7pt] break-inside-avoid rounded-[6pt] border border-line-strong px-[7pt] py-[5pt]">
      <h2 className="font-heading text-[11pt] font-semibold text-ink">Ask in the room</h2>
      <ol className="mt-[3pt] space-y-[2.5pt] text-[9pt] leading-[1.3]">
        {tied.map((question, index) => (
          <li key={`${question.claimId}-${index}`} className="flex gap-[5pt]">
            <TickBox />
            <span>
              <strong className="text-accent-text">{index + 1}.</strong> {question.text}{" "}
              <span className="text-[8pt] text-muted">({question.subjectIds.map((id) => subjects.get(id)?.name ?? "").join(", ")})</span>
            </span>
          </li>
        ))}
      </ol>
      {sets.beyond.length === 0 ? null : (
        <>
          <h3 className="mt-[5pt] text-[8.5pt] font-bold text-ink">Beyond the findings</h3>
          <ul className="mt-[2pt] space-y-[2pt] text-[9pt] leading-[1.3]">
            {sets.beyond.map((question) => (
              <li key={question} className="flex gap-[5pt]">
                <TickBox />
                {question}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// The site and date come first so they survive the cut; full addresses are in the saved briefing.
export function PrintSources({ sources }: { sources: Source[] }) {
  return (
    <ol className="columns-3 gap-[8pt] text-[7.5pt] leading-[1.3] text-muted">
      {sources.map((source) => (
        <li key={source.id} className="break-inside-avoid truncate">
          <strong className="text-ink">{source.id}</strong> {source.domain}
          {source.publishedDate === null ? "" : `, ${formatDayMonth(source.publishedDate)}`} · {source.title}
        </li>
      ))}
    </ol>
  );
}
