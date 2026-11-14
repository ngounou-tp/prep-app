// Reads a calendar invite (.ics) in the browser: the meeting time, its title, and the people
// and companies it names. Nothing is uploaded; suggestions are only offered, never auto-added.
import { MEETING_TOPIC_MAX_LENGTH } from "@/lib/types";

export type InvitePerson = { name: string; company: string | null };
export type InviteDetails = { meetingAt: string | null; allDay: boolean; title: string | null; people: InvitePerson[]; companies: string[] };

const MAX_SUGGESTIONS = 8;
const WEBMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "yandex.com", "mail.com", "zoho.com", "hey.com", "fastmail.com",
]);
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

type Property = { name: string; params: Record<string, string>; value: string };

// Long lines are folded onto continuation lines that start with a space or tab.
function eventLines(text: string): string[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toUpperCase() === "BEGIN:VEVENT");
  const end = lines.findIndex((line, index) => index > start && line.trim().toUpperCase() === "END:VEVENT");
  return start === -1 ? [] : lines.slice(start + 1, end === -1 ? undefined : end);
}

// NAME;PARAM=value;PARAM="quoted:value":VALUE, splitting at the first colon outside quotes.
function parseProperty(line: string): Property | null {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      quoted = !quoted;
    } else if (line[index] === ":" && !quoted) {
      const [name, ...rawParams] = line.slice(0, index).split(";");
      const params = Object.fromEntries(rawParams.map((param) => param.split("=")).map(([key, value]) => [key.toUpperCase(), (value ?? "").replace(/^"|"$/g, "")]));
      return { name: name.toUpperCase(), params, value: line.slice(index + 1) };
    }
  }
  return null;
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}

// How far a time zone's wall clock is ahead of UTC at a given instant, using the browser's Intl.
function zoneOffset(utcMilliseconds: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMilliseconds))
    .reduce<Record<string, number>>((all, part) => ({ ...all, [part.type]: Number(part.value) }), {});
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMilliseconds;
}

function localIso([year, month, day, hour, minute, second]: number[]): string {
  return new Date(year, month - 1, day, hour, minute, second).toISOString();
}

// A wall-clock time in a named zone, as an instant. Two passes settle daylight-saving edges.
function wallTimeToIso(fields: number[], timeZone: string | undefined): string {
  if (timeZone === undefined) {
    return localIso(fields);
  }
  const [year, month, day, hour, minute, second] = fields;
  try {
    const guess = Date.UTC(year, month - 1, day, hour, minute, second);
    const first = guess - zoneOffset(guess, timeZone);
    return new Date(guess - zoneOffset(first, timeZone)).toISOString();
  } catch {
    // Intl rejects zone names it does not know (Windows calendars use their own): use local time.
    return localIso(fields);
  }
}

// DTSTART: UTC (…Z), a named zone (TZID=…), floating local time, or a whole day (09:00 local).
function startTime(property: Property | undefined): { iso: string; allDay: boolean } | null {
  const value = property?.value.trim() ?? "";
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly !== null) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    return { iso: new Date(year, month - 1, day, 9, 0).toISOString(), allDay: true };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (dateTime === null) {
    return null;
  }
  const fields = dateTime.slice(1, 7).map((part) => Number(part ?? 0));
  if (dateTime[7] === "Z") {
    const [year, month, day, hour, minute, second] = fields;
    return { iso: new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString(), allDay: false };
  }
  return { iso: wallTimeToIso(fields, property?.params.TZID), allDay: false };
}

function titleCase(words: string): string {
  return words.split(/[-_.\s]+/).filter((word) => word !== "").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// "harbor-capital.co.uk" → "Harbor Capital". Webmail domains say nothing about a company.
export function companyFromDomain(domain: string): string | null {
  const labels = domain.toLowerCase().replace(/^www\./, "").split(".");
  if (WEBMAIL.has(labels.join(".")) || labels.length < 2) {
    return null;
  }
  const secondLevel = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2;
  return titleCase(labels[labels.length - (secondLevel ? 3 : 2)]);
}

function personFrom(property: Property): InvitePerson | null {
  const kind = property.params.CUTYPE?.toUpperCase();
  if (kind === "ROOM" || kind === "RESOURCE") {
    return null;
  }
  const email = property.value.replace(/^mailto:/i, "").trim();
  const [local, domain] = email.split("@");
  const label = property.params.CN?.trim();
  const name = label !== undefined && label !== "" && !label.includes("@") ? label : titleCase(local ?? "");
  return name === "" ? null : { name, company: domain === undefined ? null : companyFromDomain(domain) };
}

export function parseInvite(text: string): InviteDetails {
  const properties = eventLines(text).flatMap((line) => parseProperty(line) ?? []);
  const start = startTime(properties.find((property) => property.name === "DTSTART"));
  const summary = properties.find((property) => property.name === "SUMMARY");
  const people = properties
    .filter((property) => property.name === "ATTENDEE" || property.name === "ORGANIZER")
    .flatMap((property) => personFrom(property) ?? [])
    .filter((person, index, all) => all.findIndex((other) => other.name.toLowerCase() === person.name.toLowerCase()) === index)
    .slice(0, MAX_SUGGESTIONS);
  const companies = [...new Set(people.flatMap((person) => person.company ?? []))];
  return {
    meetingAt: start?.iso ?? null,
    allDay: start?.allDay ?? false,
    title: summary === undefined ? null : unescapeText(summary.value).slice(0, MEETING_TOPIC_MAX_LENGTH) || null,
    people,
    companies,
  };
}
