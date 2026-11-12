import "server-only";
import { z } from "zod";

const environmentSchema = z.object({
  TAVILY_API_KEY: z.string().trim().min(1),
  BIFROST_URL: z.url({ protocol: /^https?$/ }),
  BIFROST_MODEL: z.string().trim().min(1),
});

type Environment = z.infer<typeof environmentSchema>;

type EnvironmentSource = Record<string, string | undefined>;

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
