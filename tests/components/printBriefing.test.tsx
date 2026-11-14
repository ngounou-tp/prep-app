// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BriefingView } from "@/components/result/BriefingView";
import { PrintBriefing } from "@/components/result/PrintBriefing";
import { buildBriefing, company, fixtureClaim, person } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");
const amara = person("p1", "Amara Diallo");
const noop = () => undefined;

afterEach(cleanup);

describe("PrintBriefing", () => {
  it("prints only the developments the page selected and the sources they cite", () => {
    const claims = Array.from({ length: 10 }, (_, index) => fixtureClaim(`C${index + 1}`, ["c1"], { date: `2026-10-${String(12 + index).padStart(2, "0")}` }));
    const briefing = buildBriefing({ subjects: [northwind], claims });
    const shown = new Set(briefing.subjects[0]?.shownClaimIds);
    const left = claims.filter((claim) => !shown.has(claim.id));
    expect(left).toHaveLength(2);
    render(<PrintBriefing briefing={briefing} />);
    const report = screen.getByTestId("print-briefing");
    const developmentRows = within(report).getAllByRole("row").filter((row) => row.querySelector("td") !== null);
    expect(developmentRows).toHaveLength(8);
    expect(within(report).getByRole("columnheader", { name: /Northwind Freight/ })).toBeTruthy();
    for (const claim of left) {
      expect(within(report).queryByText(claim.text)).toBeNull();
      expect(report.textContent).not.toContain(`Headline ${claim.sourceIds[0]} `);
    }
    expect(within(report).getByText("Ask in the room")).toBeTruthy();
  });

  it("shrinks a long report to one page just before printing, and restores it after", () => {
    const tall = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1200);
    render(<PrintBriefing briefing={buildBriefing({ subjects: [northwind], claims: [fixtureClaim("C1", ["c1"])] })} />);
    const report = screen.getByTestId("print-briefing");
    window.dispatchEvent(new Event("beforeprint"));
    expect(report.style.zoom).toBe("0.83");
    expect(report.style.position).toBe("");
    window.dispatchEvent(new Event("afterprint"));
    expect(report.style.zoom).toBe("");
    tall.mockRestore();
  });

  it("names the people with their company and says who had nothing in the 30 days", () => {
    const briefing = buildBriefing({ subjects: [northwind, person("p2", "Jonas Weber", "Harbor Capital")], claims: [fixtureClaim("C1", ["c1"])] });
    render(<PrintBriefing briefing={briefing} />);
    expect(screen.getByTestId("print-briefing").textContent).toContain("Nothing found in the 30 days for Jonas Weber · Harbor Capital.");
  });

  it("keeps everyone in the printed copy when the screen is filtered to one subject", () => {
    const briefing = buildBriefing({ subjects: [northwind, amara], claims: [fixtureClaim("C1", ["c1"]), fixtureClaim("C2", ["p1"], { text: "Leads logistics deals." })] });
    render(<BriefingView briefing={briefing} onUpdate={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Amara Diallo" }));
    const report = screen.getByTestId("print-briefing");
    expect(within(report).getByText("Development C1.")).toBeTruthy();
    expect(within(report).getByText("Leads logistics deals.")).toBeTruthy();
  });
});
