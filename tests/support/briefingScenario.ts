// Test support for the briefing tests: a scripted Tavily and Bifrost on one fake network.
// Invented names and .example domains only.
import { completion, jsonResponse, stubNetwork, type ChatRequest, type tavilyResult } from "@/tests/support/testDoubles";
import type { BriefingInput, Subject } from "@/lib/types";

export const NOW = new Date("2026-11-11T08:00:00Z");

export const HUB_URL = "https://news.example/northwind-hub";
export const HUB_WIRE_URL = "https://wire.example/northwind-hub";
export const HUB_CONTENT =
  "Northwind Freight said on Tuesday that it has opened a cold-chain hub in Rotterdam, its first temperature-controlled site.";
export const HUB_QUOTE = "it has opened a cold-chain hub in Rotterdam";

const ROUTING = { routing_info: { provider: "test-provider", model: "test-model", is_fallback: false } };
const ENTITY_PATTERN = /about one entity: (.+?), a (?:company|person)/;

type ScriptedClaim = { text: string; quote: string; urls: string[]; extra?: Record<string, unknown> };

type Scenario = {
  results: Record<string, ReturnType<typeof tavilyResult>[]>;
  claims?: Record<string, ScriptedClaim[]>;
  // Replaces the model's extraction reply for one subject, to simulate failures.
  failExtraction?: (subjectName: string) => Response | undefined;
};

export function meeting(subjects: Subject[]): BriefingInput {
  return { meetingAt: "2026-11-19T10:00:00Z", meetingType: "sales-call", meetingTopic: undefined, subjects };
}

function firstQuotedName(query: string): string {
  return /^"([^"]+)"/.exec(query)?.[1] ?? "";
}

// The fake model cites by id, so it reads the ids it was shown from the formatted sources.
function sourceIdFor(userMessage: string, url: string): string {
  const line = userMessage.split("\n").find((candidate) => candidate.includes(`| ${url} |`));
  return /^\[(S\d+)\]/.exec(line ?? "")?.[1] ?? "S0";
}

function writingReply(userMessage: string): Response {
  const claims = [...userMessage.matchAll(/^\[(C\d+)\] subjects: ([^|]+) \|/gm)];
  const subjectIds = [...new Set(claims.flatMap((match) => match[2].split(",").map((id) => id.trim())))];
  const written = {
    snapshot: "Developments this month are listed below.",
    subjectLines: subjectIds.map((subjectId) => ({ subjectId, line: "One development this month." })),
    questions: claims.map((match) => ({ text: "What changed after this?", claimId: match[1] })),
  };
  return completion(JSON.stringify(written), ROUTING);
}

function extractionReply(scenario: Scenario, subjectName: string, userMessage: string): Response {
  const claims = (scenario.claims?.[subjectName] ?? []).map((scripted) => ({
    text: scripted.text,
    category: "news",
    date: null,
    quote: scripted.quote,
    sourceIds: scripted.urls.map((url) => sourceIdFor(userMessage, url)),
    ...scripted.extra,
  }));
  return completion(`Here are the claims:\n\`\`\`json\n${JSON.stringify({ claims })}\n\`\`\``, ROUTING);
}

export function stubBriefingNetwork(scenario: Scenario) {
  return stubNetwork({
    tavily: (request) => jsonResponse({ results: scenario.results[firstQuotedName(request.query)] ?? [] }),
    bifrost: (request: ChatRequest) => {
      const [system, user] = request.messages;
      const subjectName = ENTITY_PATTERN.exec(system.content)?.[1];
      if (subjectName === undefined) {
        return writingReply(user.content);
      }
      return scenario.failExtraction?.(subjectName) ?? extractionReply(scenario, subjectName, user.content);
    },
  });
}
