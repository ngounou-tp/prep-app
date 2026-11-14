import { readBriefingSearchParams } from "@/lib/client/briefingLink";
import { BriefingForm } from "./BriefingForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const NOTICES: Record<string, string> = {
  "invalid-link": "That briefing link was incomplete or had been changed, so we could not open it. Start a new one below.",
};

export async function LandingForm({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const noticeKey = typeof params.notice === "string" ? params.notice : "";
  return <BriefingForm initialInput={readBriefingSearchParams(params)} notice={NOTICES[noticeKey] ?? null} />;
}
