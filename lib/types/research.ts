import { z } from "zod";

const MAX_CLAIMS_PER_EXTRACTION = 12;
export const MAX_QUESTIONS = 10;
export const MAX_OPEN_QUESTIONS = 4;

// Exported because they are only used for their inferred types below.
export const querySchema = z.object({ text: z.string().min(1), topic: z.enum(["news", "general"]) });

export const researchWindowSchema = z.object({
  start: z.date(),
  end: z.date(),
  startDate: z.iso.date(),
  // Exclusive: Tavily's end_date means "published before", so this is the day after `end`.
  endDate: z.iso.date(),
});

export const searchHitSchema = z.object({
  subjectId: z.string(),
  title: z.string(),
  url: z.string(),
  content: z.string(),
  score: z.number(),
  publishedDate: z.string().nullable(),
});

export const sourceSchema = z.object({
  id: z.string().regex(/^S\d+$/),
  title: z.string(),
  url: z.url({ protocol: /^https?$/ }),
  domain: z.string(),
  content: z.string(),
  publishedDate: z.iso.date().nullable(),
  score: z.number(),
  subjectIds: z.array(z.string()).min(1),
});

export const researchResultSchema = z.object({
  sources: z.array(sourceSchema),
  // Every search for these subjects failed.
  failedSubjectIds: z.array(z.string()),
  // Every search for these subjects was cut off by the time budget or a disconnect.
  unfinishedSubjectIds: z.array(z.string()),
  // Searches actually sent to Tavily, retries included.
  searchesRun: z.number().int().min(0),
});

// What the model returns for one claim. A wrong category or a blank date is harmless and
// is corrected; anything else invalid fails validation and triggers the one retry.
const extractedClaimSchema = z.object({
  text: z.string().trim().min(1).max(400),
  category: z.enum(["news", "funding", "product", "people", "risk", "other"]).catch("other"),
  date: z.preprocess((value) => (value === "" || value === undefined ? null : value), z.iso.date().nullable()),
  sourceIds: z.array(z.string().trim()).min(1),
  quote: z.string().trim().min(1).max(600),
});

export const extractionSchema = z.object({
  claims: z.array(extractedClaimSchema).transform((claims) => claims.slice(0, MAX_CLAIMS_PER_EXTRACTION)),
});

const claimSchema = extractedClaimSchema.extend({ subjectIds: z.array(z.string()).min(1) });

export const claimStatusSchema = z.enum(["verified", "single-source", "unconfirmed"]);

export const verifiedClaimSchema = claimSchema.extend({
  id: z.string().regex(/^C\d+$/),
  status: claimStatusSchema,
  // The cited source the quote was found in, or null when it was not found.
  quoteSourceId: z.string().nullable(),
  sources: z.array(sourceSchema),
});

export const writtenSchema = z.object({
  snapshot: z.string().trim().min(1).max(1200),
  subjectLines: z.array(z.object({ subjectId: z.string().trim(), line: z.string().trim().min(1).max(300) })),
  questions: z
    .array(z.object({ text: z.string().trim().min(1).max(300), claimId: z.string().trim() }))
    .transform((questions) => questions.slice(0, MAX_QUESTIONS)),
  // Questions beyond the claims are optional: a reply without them is still a valid summary.
  openQuestions: z
    .array(z.object({ text: z.string().trim().min(1).max(300) }))
    .optional()
    .transform((questions) => (questions ?? []).slice(0, MAX_OPEN_QUESTIONS)),
});

export type Query = z.infer<typeof querySchema>;
export type ResearchWindow = z.infer<typeof researchWindowSchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export type VerifiedClaim = z.infer<typeof verifiedClaimSchema>;
export type Written = z.infer<typeof writtenSchema>;
