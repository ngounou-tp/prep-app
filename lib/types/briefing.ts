import { z } from "zod";
import { briefingInputSchema } from "./input";
import { sourceSchema, verifiedClaimSchema } from "./research";

// isFallback is null when Bifrost did not say (no extra_fields in the response).
const modelRoutingSchema = z.object({ provider: z.string(), model: z.string(), isFallback: z.boolean().nullable() });

const modelCallSchema = modelRoutingSchema.extend({ purpose: z.enum(["extract", "write"]), subjectId: z.string().nullable() });

const count = z.number().int().min(0);
const statusCountsSchema = z.object({ verified: count, singleSource: count, unconfirmed: count });

const subjectNoteSchema = z.object({
  kind: z.enum(["research-failed", "model-rate-limit", "model-failed", "not-completed", "nothing-found"]),
  message: z.string(),
});

const subjectSectionSchema = z.object({
  subjectId: z.string(),
  line: z.string().nullable(),
  // Claims shown under this subject within the page budget, best first.
  shownClaimIds: z.array(z.string()),
  // Verified or single-source claims for this subject left off the page.
  moreCount: count,
  counts: statusCountsSchema,
  note: subjectNoteSchema.nullable(),
});

// People are grouped under their company when it is a subject or when they name it.
const companyGroupSchema = z.object({
  companyName: z.string().nullable(),
  companySubjectId: z.string().nullable(),
  personSubjectIds: z.array(z.string()),
});

export const briefingResultSchema = z.object({
  input: briefingInputSchema,
  window: z.object({ startDate: z.iso.date(), lastDate: z.iso.date(), endDate: z.iso.date() }),
  generatedAt: z.iso.datetime(),
  subjects: z.array(subjectSectionSchema),
  groups: z.array(companyGroupSchema),
  claims: z.array(verifiedClaimSchema),
  // Verified claims tagged with two or more subjects: the only connections the page may show.
  sharedClaimIds: z.array(z.string()),
  // null when the writing call failed or ran out of time; the claims are still shown.
  snapshot: z.string().nullable(),
  questions: z.array(z.object({ text: z.string(), claimId: z.string(), subjectIds: z.array(z.string()).min(1) })),
  // Not tied to a claim, so they state no fact; older saved briefings have none.
  openQuestions: z.array(z.string()).default([]),
  // Sources cited by a claim; `research.sourcesFound` counts every source kept, cited or not.
  sources: z.array(sourceSchema),
  research: z.object({ searchesRun: count, sourcesFound: count }),
  counts: statusCountsSchema,
  modelCalls: z.array(modelCallSchema),
});

export type ModelRouting = z.infer<typeof modelRoutingSchema>;
export type ModelCall = z.infer<typeof modelCallSchema>;
export type StatusCounts = z.infer<typeof statusCountsSchema>;
export type SubjectNote = z.infer<typeof subjectNoteSchema>;
export type SubjectSection = z.infer<typeof subjectSectionSchema>;
export type CompanyGroup = z.infer<typeof companyGroupSchema>;
export type BriefingResult = z.infer<typeof briefingResultSchema>;
