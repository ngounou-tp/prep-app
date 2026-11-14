import "server-only";
import { z } from "zod";

export type EnvironmentSource = Record<string, string | undefined>;

// Blank values in .env files count as unset, so optional settings fall back to their defaults.
function blankAsUnset(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function integerSetting(defaultValue: number, minimum: number, maximum: number) {
  return z.preprocess(
    blankAsUnset,
    z.coerce.number().int().min(minimum).max(maximum).default(defaultValue),
  );
}

// "auto" means: ask Bifrost which models its providers offer (lib/model/modelChoice.ts).
const AUTO = "auto";
const providerModelId = z.string().regex(/^[^/\s]+\/\S+$/);

const modelSetting = z.preprocess(
  blankAsUnset,
  z
    .string()
    .trim()
    .default(AUTO)
    .transform((value) => (value.toLowerCase() === AUTO ? AUTO : value)),
);

const fallbackSetting = z.preprocess(
  blankAsUnset,
  z
    .string()
    .optional()
    .transform((value): string[] | typeof AUTO => {
      if (value === undefined) {
        return [];
      }
      return value.trim().toLowerCase() === AUTO ? AUTO : value.split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
    })
    .pipe(z.union([z.literal(AUTO), z.array(providerModelId)])),
);

const environmentSchema = z.object({
  TAVILY_API_KEY: z.string().trim().min(1),
  BIFROST_URL: z.url({ protocol: /^https?$/ }),
  BIFROST_MODEL: modelSetting,
  BIFROST_API_KEY: z.preprocess(blankAsUnset, z.string().trim().optional()),
  BIFROST_FALLBACK_MODELS: fallbackSetting,
  LLM_CONCURRENCY: integerSetting(1, 1, 6),
  LLM_PAUSE_MS: integerSetting(1000, 0, 60_000),
  // CLAUDE.md caps research at 12 sources per subject.
  MAX_SOURCES_PER_SUBJECT: integerSetting(8, 1, 12),
  SOURCE_CHARS: integerSetting(800, 200, 1500),
});

export type Environment = z.infer<typeof environmentSchema>;

// Names the variable and the problem but never echoes a value, so a secret cannot leak into logs.
function describeProblem(name: string, source: EnvironmentSource): string {
  const value = source[name];
  if (value === undefined || value.trim() === "") {
    return `${name} is missing`;
  }
  return `${name} is not valid`;
}

export function readEnvironment(source: EnvironmentSource = process.env): Environment {
  const result = environmentSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  const problems = names.map((name) => describeProblem(name, source)).join("; ");
  throw new Error(
    `Environment configuration error: ${problems}. Check .env.local against .env.example.`,
  );
}
