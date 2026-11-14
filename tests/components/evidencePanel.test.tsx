// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BriefingView } from "@/components/result/BriefingView";
import { buildBriefing, company, fixtureClaim, fixtureSource } from "@/tests/support/briefingFixture";

const northwind = company("c1", "Northwind Freight");
const HUB = "Opened a cold-chain hub in Rotterdam.";

function briefing() {
  return buildBriefing({
    subjects: [northwind],
    claims: [
      fixtureClaim("C1", ["c1"], { text: HUB, sources: [fixtureSource("S1", ["c1"]), fixtureSource("S2", ["c1"], { domain: "wire.example" })] }),
      fixtureClaim("C2", ["c1"], { text: "Closed a funding round.", date: "2026-10-30" }),
      fixtureClaim("C3", ["c1"], { text: "Said to be buying a software firm.", status: "unconfirmed" }),
    ],
  });
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("EvidencePanel", () => {
  it("opens as a labelled modal dialog, moves focus in and keeps it inside", async () => {
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: HUB }));
    const dialog = await screen.findByRole("dialog", { name: HUB });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(window.location.hash).toBe("#claim-C1");
    const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close evidence" }));
    focusable.at(-1)?.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(focusable[0]);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(focusable.at(-1));
  });

  it("closes on Escape and returns focus to the development that opened it", async () => {
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: HUB }));
    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement?.id).toBe("open-C1");
    expect(window.location.hash).toBe("");
  });

  it("opens from the URL hash", () => {
    window.history.replaceState(null, "", "/briefing#claim-C2");
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    expect(screen.getByRole("dialog", { name: "Closed a funding round." })).toBeTruthy();
  });

  it("highlights the verified quote in the source text and lists only the checks that passed", () => {
    window.history.replaceState(null, "", "/briefing#claim-C1");
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    const dialog = screen.getByRole("dialog");
    const marks = [...dialog.querySelectorAll("mark")].map((mark) => mark.textContent);
    expect(marks).toEqual(["it has opened a cold-chain hub in Rotterdam", "it has opened a cold-chain hub in Rotterdam"]);
    const checks = within(dialog).getByRole("heading", { name: "How we checked this" }).closest("section");
    expect(within(checks ?? dialog).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "The supporting sentence was found word for word in S1, news.example.",
      expect.stringMatching(/^Published .+, inside the 30 days we read\.$/),
      "Two independent sites report it.",
    ]);
  });

  it("explains the failed check for an unconfirmed claim", () => {
    window.history.replaceState(null, "", "/briefing#claim-C3");
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Why we could not verify this" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "How we checked this" })).toBeNull();
  });

  it("steps through the visible list, newest first", async () => {
    window.history.replaceState(null, "", "/briefing#claim-C2");
    render(<BriefingView briefing={briefing()} onUpdate={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Next development/ }));
    expect(await screen.findByRole("dialog", { name: HUB })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Next development/ })).toBeNull();
  });
});
