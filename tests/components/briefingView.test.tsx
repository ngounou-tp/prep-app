// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BriefingView } from "@/components/result/BriefingView";
import { readBriefingSearchParams } from "@/lib/client/briefingLink";
import { buildBriefing, company, fixtureClaim, fixtureSource, person } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");
const amara = person("p1", "Amara Diallo", "Northwind Freight");
const jonas = person("p2", "Jonas Weber", "Harbor Capital");
const noop = () => undefined;

function meetingOfThree() {
  return buildBriefing({
    subjects: [northwind, amara, jonas],
    claims: [
      fixtureClaim("C1", ["c1"], { text: "Opened a cold-chain hub in Rotterdam." }),
      fixtureClaim("C2", ["c1", "p1"], { text: "Named a new finance chief.", date: "2026-11-03", sources: [fixtureSource("S2", ["c1", "p1"])] }),
      fixtureClaim("C3", ["p2"], { text: "Leads logistics deals.", status: "single-source", date: "2026-10-29", sources: [fixtureSource("S3", ["p2"])] }),
    ],
  });
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("BriefingView", () => {
  it("nests a person under their company and gives a person at another company a top-level heading", () => {
    render(<BriefingView briefing={meetingOfThree()} onUpdate={noop} />);
    expect(screen.getByRole("heading", { level: 3, name: "Amara Diallo" }).closest("section")?.className).toContain("pl-4");
    const jonasSection = screen.getByRole("heading", { level: 3, name: "Jonas Weber" }).closest("section");
    expect(jonasSection?.className).not.toContain("pl-4");
    expect(within(jonasSection ?? document.body).getByText(/Person · Harbor Capital/)).toBeTruthy();
  });

  it("renders a shared claim once, with its Also about tag", () => {
    render(<BriefingView briefing={meetingOfThree()} onUpdate={noop} />);
    const shared = screen.getAllByRole("button", { name: "Named a new finance chief." });
    expect(shared).toHaveLength(1);
    expect(within(shared[0]?.closest("article") ?? document.body).getByText("Also about Northwind Freight")).toBeTruthy();
  });

  it("filters developments, timeline dots and questions to one subject without a request", () => {
    render(<BriefingView briefing={meetingOfThree()} onUpdate={noop} />);
    expect(screen.getAllByRole("link", { name: /Northwind Freight/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Jonas Weber" }));
    expect(screen.getByRole("button", { name: "Jonas Weber" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Opened a cold-chain hub in Rotterdam." })).toBeNull();
    expect(screen.getByRole("button", { name: "Leads logistics deals." })).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /Northwind Freight/ })).toHaveLength(0);
    const onScreen = within(screen.getByRole("main"));
    expect(onScreen.getByText("What changed after C1?").closest("li")?.hidden).toBe(true);
    expect(onScreen.getByText("What changed after C3?").closest("li")?.hidden).toBe(false);
  });

  it("shows at most the 8 selected developments, with the rest behind 'more found'", () => {
    const claims = Array.from({ length: 10 }, (_, index) => fixtureClaim(`C${index + 1}`, ["c1"], { date: `2026-10-${String(12 + index).padStart(2, "0")}` }));
    render(<BriefingView briefing={buildBriefing({ subjects: [northwind], claims })} onUpdate={noop} />);
    const onScreen = within(screen.getByRole("main"));
    expect(onScreen.getAllByRole("article")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "2 more found" }));
    expect(onScreen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("never renders a javascript: address from a source as a link", () => {
    const hostile = fixtureSource("S1", ["c1"], { url: "javascript:alert(1)", title: "Hostile page" });
    const { container } = render(<BriefingView briefing={buildBriefing({ subjects: [northwind], claims: [fixtureClaim("C1", ["c1"], { sources: [hostile] })] })} onUpdate={noop} />);
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.getByText("Hostile page").tagName).toBe("SPAN");
  });
});

describe("BriefingView states", () => {
  it("shows one clear empty message whose edit link keeps the input", () => {
    const briefing = buildBriefing({ subjects: [northwind, amara] });
    render(<BriefingView briefing={briefing} onUpdate={noop} />);
    expect(screen.getByRole("heading", { level: 1, name: /Nothing significant between/ })).toBeTruthy();
    expect(screen.getByText(/We ran 9 searches about/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "What changed" })).toBeNull();
    const href = screen.getByRole("link", { name: /Edit and try again/ }).getAttribute("href") ?? "";
    expect(readBriefingSearchParams(Object.fromEntries(new URLSearchParams(href.split("?")[1])))).toEqual({
      ...briefing.input,
      subjects: briefing.input.subjects.map((subject, index) => ({ ...subject, id: `s${index + 1}` })),
    });
  });

  it("shows the partial banner, a retry button and a faded subject only when a subject failed", () => {
    const partial = buildBriefing({ subjects: [northwind, jonas], claims: [fixtureClaim("C1", ["c1"])], outcomes: { p2: "not-completed" } });
    render(<BriefingView briefing={partial} onUpdate={noop} />);
    expect(screen.getByRole("heading", { name: "Your briefing is ready for 1 of 2 people and companies." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish Jonas Weber" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try this one again" })).toBeTruthy();
    expect(screen.getByText(/Not finished\. We found/)).toBeTruthy();
    cleanup();
    render(<BriefingView briefing={meetingOfThree()} onUpdate={noop} />);
    expect(screen.queryByText(/Your briefing is ready for/)).toBeNull();
  });

  it("says what was searched for a subject with no findings", () => {
    render(<BriefingView briefing={buildBriefing({ subjects: [northwind, amara], claims: [fixtureClaim("C1", ["c1"])] })} onUpdate={noop} />);
    expect(screen.getByText(/searched news, new roles and announcements and found nothing to report/)).toBeTruthy();
  });
});
