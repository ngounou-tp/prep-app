import { createBriefing } from "@/lib/briefing/briefing";
import { handleBriefingRequest } from "@/lib/http/briefingRequest";
import { createSubjectRateLimiter } from "@/lib/http/rateLimit";

// Runs on the Node.js runtime, Next.js's default. With Cache Components enabled, Next.js 16
// rejects an explicit `export const runtime`, and the only alternative (edge) is deprecated.

// The pipeline keeps itself under 55 seconds (lib/briefing/timeBudget.ts); this is the platform's hard stop.
export const maxDuration = 60;

// One limiter per server instance; lib/http/rateLimit.ts explains why this is best-effort.
const limiter = createSubjectRateLimiter();

export function POST(request: Request): Promise<Response> {
  return handleBriefingRequest(request, { limiter, createBriefing, now: () => new Date() });
}
