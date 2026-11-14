// The wire format of POST /api/briefing, shared by the server and the browser. Events carry
// counts, dates, ids and claim text only: never source content, keys or upstream details.
import { z } from "zod";
import { briefingResultSchema } from "./briefing";
import { claimStatusSchema } from "./research";

const count = z.number().int().min(0);

export const progressEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("searching"), subjectId: z.string(), queryCount: count }),
  // One id and one date per source kept for the subject (null when undated), for the 30-day
  // chart. Ids let the page count a source shared by two subjects once.
  z.object({
    type: z.literal("sources"),
    subjectId: z.string(),
    count,
    sourceIds: z.array(z.string()),
    publishedDates: z.array(z.iso.date().nullable()),
  }),
  // The model is rate limited for this subject; the one retry starts after the wait.
  z.object({ type: z.literal("retrying"), subjectId: z.string(), waitSeconds: count }),
  // This subject's reading call finished, so its row can show Done or Not finished at once.
  z.object({
    type: z.literal("extracted"),
    subjectId: z.string(),
    outcome: z.enum(["ok", "no-sources", "rate-limit", "failed", "not-completed"]),
    claimCount: count,
  }),
  // subjectIds, not one id: a shared claim belongs to every subject that found it. `checks`
  // names only checks that passed: the quote's source and domain, its date, a second site.
  z.object({
    type: z.literal("checking"),
    subjectIds: z.array(z.string()).min(1),
    checked: count,
    total: count,
    claim: z.object({ text: z.string(), status: claimStatusSchema }),
    checks: z.object({
      quoteSourceId: z.string().nullable(),
      quoteDomain: z.string().nullable(),
      publishedDate: z.iso.date().nullable(),
      secondSourceId: z.string().nullable(),
    }),
  }),
  z.object({ type: z.literal("writing") }),
  z.object({ type: z.literal("done") }),
]);

export const streamLineSchema = z.discriminatedUnion("type", [
  ...progressEventSchema.options,
  z.object({ type: z.literal("result"), briefing: briefingResultSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

// The JSON body of a 400, 413, 415 or 429 response. Messages are safe to show a user.
export const apiErrorSchema = z.object({
  error: z.string(),
  fields: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type ProgressEvent = z.infer<typeof progressEventSchema>;
export type StreamLine = z.infer<typeof streamLineSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
