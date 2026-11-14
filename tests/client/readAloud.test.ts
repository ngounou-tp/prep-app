import { describe, expect, it } from "vitest";
import { listeningMinutes, readAloudPassages } from "@/lib/client/readAloud";
import { buildBriefing, company, fixtureClaim } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");

describe("readAloudPassages", () => {
  const briefing = buildBriefing({
    subjects: [northwind],
    claims: [
      fixtureClaim("C1", ["c1"], { text: "Opened a cold-chain hub in Rotterdam." }),
      fixtureClaim("C2", ["c1"], { text: "Said to be buying a software firm.", status: "unconfirmed" }),
    ],
  });
  const passages = readAloudPassages(briefing);

  it("reads the meeting, the snapshot, each development with its status, then the questions", () => {
    expect(passages[0]).toMatch(/^Briefing for your sales call on /);
    expect(passages).toContain("Developments this month are listed below.");
    expect(passages).toContain("Northwind Freight.");
    expect(passages.some((passage) => /^On .+: Opened a cold-chain hub in Rotterdam\. Verified\.$/.test(passage))).toBe(true);
    expect(passages.slice(-2)).toEqual(["Questions to ask.", "Question 1, for Northwind Freight: What changed after C1?"]);
  });

  it("leaves out claims that could not be verified", () => {
    expect(passages.join(" ")).not.toContain("software firm");
  });

  it("estimates at least one minute of listening", () => {
    expect(listeningMinutes(passages)).toBe(1);
  });
});
