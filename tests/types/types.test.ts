import { describe, expect, it } from "vitest";
import { briefingInputSchema } from "@/lib/types";

function input(subjects: unknown[]) {
  return { meetingAt: "2026-11-19T10:00:00Z", meetingType: "sales-call", subjects };
}

const company = { id: "c1", name: "Northwind Freight", type: "company" };

function companies(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `c${index}`, name: `Company ${index}`, type: "company" }));
}

describe("briefingInputSchema", () => {
  it("accepts a company and a person with their company, and drops blank optional fields", () => {
    const result = briefingInputSchema.parse(
      input([
        { ...company, context: "  " },
        { id: "p1", name: " Amara Diallo ", type: "person", company: "Northwind Freight" },
      ]),
    );
    expect(result.subjects[0]?.context).toBeUndefined();
    expect(result.subjects[1]).toMatchObject({ name: "Amara Diallo", company: "Northwind Freight" });
  });

  it("rejects the same subject twice after normalising case and spaces", () => {
    const duplicate = { id: "c2", name: "  northwind   FREIGHT ", type: "company" };
    const result = briefingInputSchema.safeParse(input([company, duplicate]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("This subject is already in the list");
  });

  it("allows a company and a person who share a name", () => {
    const person = { id: "p1", name: "Northwind Freight", type: "person" };
    expect(briefingInputSchema.safeParse(input([company, person])).success).toBe(true);
  });

  it("rejects two subjects with the same id", () => {
    const sameId = { id: "c1", name: "Harbor Capital", type: "company" };
    expect(briefingInputSchema.safeParse(input([company, sameId])).success).toBe(false);
  });

  it("accepts one to five subjects and rejects none or six", () => {
    expect(briefingInputSchema.safeParse(input(companies(1))).success).toBe(true);
    expect(briefingInputSchema.safeParse(input(companies(5))).success).toBe(true);
    expect(briefingInputSchema.safeParse(input([])).success).toBe(false);
    expect(briefingInputSchema.safeParse(input(companies(6))).success).toBe(false);
  });

  it("caps the name at 120 and the context and company at 200 characters", () => {
    expect(briefingInputSchema.safeParse(input([{ ...company, name: "N".repeat(121) }])).success).toBe(false);
    expect(briefingInputSchema.safeParse(input([{ ...company, context: "C".repeat(201) }])).success).toBe(false);
    expect(briefingInputSchema.safeParse(input([{ ...company, context: "C".repeat(200) }])).success).toBe(true);
    const person = { id: "p1", name: "Amara Diallo", type: "person" };
    expect(briefingInputSchema.safeParse(input([{ ...person, company: "C".repeat(200) }])).success).toBe(true);
    expect(briefingInputSchema.safeParse(input([{ ...person, company: "C".repeat(201) }])).success).toBe(false);
  });

  it("rejects a company field on a company subject", () => {
    expect(briefingInputSchema.safeParse(input([{ ...company, company: "Harbor Capital" }])).success).toBe(false);
  });

  it("needs a topic when the meeting type is other", () => {
    expect(briefingInputSchema.safeParse({ ...input([company]), meetingType: "other" }).success).toBe(false);
    expect(briefingInputSchema.safeParse({ ...input([company]), meetingType: "other", meetingTopic: "  " }).success).toBe(false);
    const parsed = briefingInputSchema.safeParse({ ...input([company]), meetingType: "other", meetingTopic: " Hackathon judging " });
    expect(parsed.data?.meetingTopic).toBe("Hackathon judging");
    expect(briefingInputSchema.safeParse({ ...input([company]), meetingType: "other", meetingTopic: "x".repeat(81) }).success).toBe(false);
  });

  it("rejects a meeting time without a timezone", () => {
    const local = { ...input([company]), meetingAt: "2026-11-19T10:00" };
    expect(briefingInputSchema.safeParse(local).success).toBe(false);
  });
});
