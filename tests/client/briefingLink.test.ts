import { describe, expect, it } from "vitest";
import { briefingSearchParams, readBriefingSearchParams } from "@/lib/client/briefingLink";
import type { BriefingInput } from "@/lib/types";
import { company, person } from "@/tests/support/briefingFixture";

const input: BriefingInput = {
  meetingAt: "2026-11-19T10:00:00.000Z",
  meetingType: "investor",
  meetingTopic: undefined,
  subjects: [company("s1", "Northwind Freight"), person("s2", "Amélie Dubois", "Northwind Freight")],
};

function read(query: string) {
  return readBriefingSearchParams(Object.fromEntries(new URLSearchParams(query)));
}

describe("briefing link", () => {
  it("round-trips the input, including accented names", () => {
    expect(read(briefingSearchParams(input))).toEqual(input);
  });

  it("keeps the subjects in one base64url parameter with no padding", () => {
    const encoded = new URLSearchParams(briefingSearchParams(input)).get("s") ?? "";
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a subjects parameter over 2000 characters", () => {
    const params = new URLSearchParams(briefingSearchParams(input));
    params.set("s", "A".repeat(2001));
    expect(read(params.toString())).toBeNull();
  });

  it("rejects tampered, missing or invalid values", () => {
    const params = new URLSearchParams(briefingSearchParams(input));
    expect(read(`${params.toString()}x!`)).toBeNull();
    params.delete("at");
    expect(read(params.toString())).toBeNull();
    expect(read("at=2026-11-19T10:00:00Z&type=lunch&s=W10")).toBeNull();
  });
});

describe("briefing link with a meeting topic", () => {
  it("keeps the user's own meeting topic", () => {
    const other: BriefingInput = { ...input, meetingType: "other", meetingTopic: "Hackathon judging" };
    expect(read(briefingSearchParams(other))).toEqual(other);
  });
});
