import { z } from "zod";

// CLAUDE.md caps names at 120 and context at 200; a person's company may be up to 200.
const NAME_MAX_LENGTH = 120;
const CONTEXT_MAX_LENGTH = 200;
const COMPANY_MAX_LENGTH = 200;
const MAX_SUBJECTS = 5;

// Optional form fields arrive as "" when left blank; treat that the same as absent.
function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value === "" ? undefined : value));
}

// "Northwind  Freight" and "northwind freight" are the same subject.
export function normaliseName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

const subjectSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
    type: z.enum(["company", "person"]),
    context: optionalText(CONTEXT_MAX_LENGTH),
    company: optionalText(COMPANY_MAX_LENGTH),
  })
  .refine((subject) => subject.type === "person" || subject.company === undefined, {
    message: "Only a person can name a company",
    path: ["company"],
  });

const subjectListSchema = z
  .array(subjectSchema)
  .min(1)
  .max(MAX_SUBJECTS)
  .superRefine((subjects, context) => {
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    subjects.forEach((subject, index) => {
      const nameKey = `${subject.type}:${normaliseName(subject.name)}`;
      if (seenNames.has(nameKey)) {
        context.addIssue({ code: "custom", path: [index, "name"], message: "This subject is already in the list" });
      }
      if (seenIds.has(subject.id)) {
        context.addIssue({ code: "custom", path: [index, "id"], message: "Subject ids must be unique" });
      }
      seenNames.add(nameKey);
      seenIds.add(subject.id);
    });
  });

// "other" lets the user say what the meeting is about in their own words.
export const MEETING_TOPIC_MAX_LENGTH = 80;

export const briefingInputSchema = z
  .object({
    meetingAt: z.iso.datetime({ offset: true }),
    meetingType: z.enum(["sales-call", "investor", "partnership", "business-development", "first-intro", "other"]),
    meetingTopic: optionalText(MEETING_TOPIC_MAX_LENGTH),
    subjects: subjectListSchema,
  })
  .superRefine((input, context) => {
    if (input.meetingType === "other" && input.meetingTopic === undefined) {
      context.addIssue({ code: "custom", path: ["meetingTopic"], message: "Say in a few words what the meeting is about." });
    }
  });

export type BriefingInput = z.infer<typeof briefingInputSchema>;
export type Subject = z.infer<typeof subjectSchema>;
