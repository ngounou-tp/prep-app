import type { Query, Subject } from "@/lib/types";

// Tavily asks for queries under 400 characters; context is shortened first to fit.
const MAX_QUERY_LENGTH = 400;

// `label` is how the page describes the angle: "We searched news and new roles".
type Angle = { terms: string; topic: Query["topic"]; label: string };

// Priority order: when the budget is cut, the news and leadership angles survive first.
const COMPANY_ANGLES: readonly Angle[] = [
  { terms: "latest news", topic: "news", label: "news" },
  { terms: "leadership changes executive appointments", topic: "news", label: "leadership changes" },
  { terms: "funding round investment acquisition deal", topic: "news", label: "funding and deals" },
  { terms: "product launch new product announcement", topic: "general", label: "product launches" },
  { terms: "lawsuit layoffs investigation risks", topic: "news", label: "risks" },
];

const PERSON_ANGLES: readonly Angle[] = [
  { terms: "latest news", topic: "news", label: "news" },
  { terms: "new role appointment", topic: "news", label: "new roles" },
  { terms: "announcement statement", topic: "news", label: "announcements" },
  { terms: "interview podcast conference talk", topic: "general", label: "interviews and talks" },
];

// What a subject's searches covered, for "We searched news, new roles and announcements".
export function searchedTopics(subjectType: Subject["type"], subjectCount: number): string[] {
  const angles = subjectType === "person" ? PERSON_ANGLES : COMPANY_ANGLES;
  return angles.slice(0, searchBudget(subjectCount, subjectType)).map((angle) => angle.label);
}

// A stray double quote in user input would break the exact-phrase quoting.
function cleanText(text: string): string {
  return text.replace(/"/g, " ").replace(/\s+/g, " ").trim();
}

function quote(text: string): string {
  return `"${cleanText(text)}"`;
}

function composeQuery(subject: Subject, angle: Angle): string {
  const phrases = [quote(subject.name)];
  if (subject.type === "person" && subject.company !== undefined) {
    phrases.push(quote(subject.company));
  }
  const base = [...phrases, angle.terms].join(" ");
  const context = subject.context === undefined ? "" : cleanText(subject.context);
  const room = MAX_QUERY_LENGTH - base.length - 1;
  if (context === "" || room <= 0) {
    return base.slice(0, MAX_QUERY_LENGTH);
  }
  return `${base} ${context.slice(0, room).trim()}`;
}

export function searchBudget(subjectCount: number, subjectType: Subject["type"]): number {
  if (subjectCount <= 1) {
    return subjectType === "person" ? 4 : 5;
  }
  return subjectCount <= 3 ? 3 : 2;
}

export function buildQueries(subject: Subject, budget: number): Query[] {
  const angles = subject.type === "person" ? PERSON_ANGLES : COMPANY_ANGLES;
  return angles
    .slice(0, Math.max(0, budget))
    .map((angle) => ({ text: composeQuery(subject, angle), topic: angle.topic }));
}

export type PlannedSearch = { subjectId: string; query: Query };

export function planSearches(subjects: readonly Subject[]): PlannedSearch[] {
  return subjects.flatMap((subject) =>
    buildQueries(subject, searchBudget(subjects.length, subject.type)).map((query) => ({ subjectId: subject.id, query })),
  );
}
