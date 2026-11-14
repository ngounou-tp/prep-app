import { describe, expect, it } from "vitest";
import { companyFromDomain, parseInvite } from "@/lib/client/calendarInvite";

// Invented people and reserved .example domains only.
const INVITE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Europe/Paris:20261119T100000",
  "SUMMARY:Quarterly review with Harbor Capital\\, Rotterdam",
  "ORGANIZER;CN=Me:mailto:me@gmail.com",
  'ATTENDEE;CN="Jonas',
  '  Weber";ROLE=REQ-PARTICIPANT:mailto:jonas@harbor-capital.example',
  "ATTENDEE;CUTYPE=ROOM;CN=Room 4:mailto:room4@harbor-capital.example",
  "ATTENDEE:mailto:amara.diallo@northwind-freight.co.uk",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function withStart(line: string): string {
  return ["BEGIN:VEVENT", line, "END:VEVENT"].join("\r\n");
}

describe("parseInvite", () => {
  it("reads the time in its zone, the title, the people and their companies", () => {
    const invite = parseInvite(INVITE);
    expect(invite.meetingAt).toBe("2026-11-19T09:00:00.000Z");
    expect(invite.allDay).toBe(false);
    expect(invite.title).toBe("Quarterly review with Harbor Capital, Rotterdam");
    expect(invite.people).toEqual([
      { name: "Me", company: null },
      { name: "Jonas Weber", company: "Harbor Capital" },
      { name: "Amara Diallo", company: "Northwind Freight" },
    ]);
    expect(invite.companies).toEqual(["Harbor Capital", "Northwind Freight"]);
  });

  it("handles UTC, floating local time, all-day events and unknown zone names", () => {
    expect(parseInvite(withStart("DTSTART:20261119T100000Z")).meetingAt).toBe("2026-11-19T10:00:00.000Z");
    expect(parseInvite(withStart("DTSTART:20261119T100000")).meetingAt).toBe(new Date(2026, 10, 19, 10, 0).toISOString());
    expect(parseInvite(withStart("DTSTART;TZID=W. Europe Standard Time:20261119T100000")).meetingAt).toBe(new Date(2026, 10, 19, 10, 0).toISOString());
    const allDay = parseInvite(withStart("DTSTART;VALUE=DATE:20261119"));
    expect(allDay).toMatchObject({ meetingAt: new Date(2026, 10, 19, 9, 0).toISOString(), allDay: true });
  });

  it("finds nothing in a file without an event", () => {
    expect(parseInvite("not a calendar")).toEqual({ meetingAt: null, allDay: false, title: null, people: [], companies: [] });
  });
});

describe("companyFromDomain", () => {
  it("turns a company domain into a name and ignores webmail", () => {
    expect(companyFromDomain("www.harbor-capital.example")).toBe("Harbor Capital");
    expect(companyFromDomain("northwind.co.uk")).toBe("Northwind");
    expect(companyFromDomain("outlook.com")).toBeNull();
  });
});
