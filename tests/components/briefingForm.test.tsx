// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BriefingForm } from "@/components/landing/BriefingForm";
import { readBriefingSearchParams } from "@/lib/client/briefingLink";

const router = vi.hoisted(() => ({ push: vi.fn(), bfcacheId: "visit-1" }));
const { push } = router;
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function nameField(): HTMLInputElement {
  return screen.getByLabelText("Name");
}

function addByEnter(name: string) {
  fireEvent.change(nameField(), { target: { value: name } });
  fireEvent.keyDown(nameField(), { key: "Enter" });
}

afterEach(() => {
  cleanup();
  push.mockReset();
  router.bfcacheId = "visit-1";
});

describe("BriefingForm", () => {
  it("adds on Enter, returns focus to the name field and announces the change", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Northwind Freight");
    expect(screen.getByText("Northwind Freight")).toBeTruthy();
    expect(nameField().value).toBe("");
    expect(document.activeElement).toBe(nameField());
    expect(screen.getByText("Added Northwind Freight. 1 of 5.")).toBeTruthy();
    expect(screen.getByText("1 of 5")).toBeTruthy();
  });

  it("explains a duplicate next to the field", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Northwind Freight");
    addByEnter("NORTHWIND freight");
    expect(screen.getByText("NORTHWIND freight is already in the list.")).toBeTruthy();
    expect(nameField().getAttribute("aria-describedby")).toContain("subject-name-error");
  });

  it("moves focus to the next row after removing one", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Alpha Example");
    addByEnter("Bravo Example");
    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha Example" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Bravo Example" }));
    expect(screen.getByText("Removed Alpha Example. 1 of 5.")).toBeTruthy();
  });

  it("replaces the add area with an explanation at five", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].forEach((name) => addByEnter(`${name} Example`));
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByText(/the most one briefing covers/)).toBeTruthy();
  });

  it("puts the meeting first: when, what kind, then who", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["1When is the meeting?", "2What kind of meeting?", "3Who will be there?"]);
  });

  it("adds a person with their company, from Enter in the company field", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    fireEvent.change(nameField(), { target: { value: "Amara Diallo" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "person" } });
    fireEvent.change(screen.getByLabelText("Their company, optional"), { target: { value: "Northwind Freight" } });
    fireEvent.keyDown(screen.getByLabelText("Their company, optional"), { key: "Enter" });
    expect(screen.getByText("Amara Diallo")).toBeTruthy();
    expect(document.activeElement).toBe(nameField());
  });

  it("explains what is missing on submit instead of disabling the button", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    const submit = screen.getByRole("button", { name: /Prepare my briefing/ });
    expect(submit.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submit);
    expect(screen.getByText("Add at least one person or company.")).toBeTruthy();
    expect(screen.getByText("Choose the date and time of the meeting.")).toBeTruthy();
    expect(screen.getByLabelText("Meeting date and time").getAttribute("aria-describedby")).toBe("meeting-at-error");
    expect(document.activeElement).toBe(screen.getByLabelText("Meeting date and time"));
    expect(push).not.toHaveBeenCalled();
  });

  it("goes to the briefing page with the whole input in the URL", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Northwind Freight");
    fireEvent.change(screen.getByLabelText("Meeting date and time"), { target: { value: "2026-11-19T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Investor" }));
    fireEvent.click(screen.getByRole("button", { name: /Prepare my briefing/ }));
    const target = String(push.mock.calls[0]?.[0]);
    expect(target.startsWith("/briefing?")).toBe(true);
    const input = readBriefingSearchParams(Object.fromEntries(new URLSearchParams(target.split("?")[1])));
    expect(input).toMatchObject({ meetingType: "investor", subjects: [{ name: "Northwind Freight", type: "company" }] });
    expect(input?.meetingAt).toBe(new Date("2026-11-19T10:00").toISOString());
  });

  it("fills in the previous input after Edit and try again", () => {
    const initialInput = {
      meetingAt: "2026-11-19T10:00:00.000Z",
      meetingType: "partnership" as const,
      meetingTopic: undefined,
      subjects: [{ id: "s1", name: "Northwind Freight", type: "company" as const, company: undefined, context: undefined }],
    };
    render(<BriefingForm initialInput={initialInput} notice={null} />);
    expect(screen.getByText("Northwind Freight")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Partnership" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Meeting date and time") as HTMLInputElement).value).not.toBe("");
  });

  it("starts empty again on a new visit, but keeps what was typed when the page only re-renders", () => {
    const { rerender } = render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Northwind Freight");
    rerender(<BriefingForm initialInput={null} notice={null} />);
    expect(screen.getByText("Northwind Freight")).toBeTruthy();
    router.bfcacheId = "visit-2";
    rerender(<BriefingForm initialInput={null} notice={null} />);
    expect(screen.queryByText("Northwind Freight")).toBeNull();
    expect(screen.getByText("0 of 5")).toBeTruthy();
  });

  it("asks what the meeting is about when the type is Other, and sends the topic", () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    addByEnter("Northwind Freight");
    fireEvent.change(screen.getByLabelText("Meeting date and time"), { target: { value: "2026-11-19T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.click(screen.getByRole("button", { name: /Prepare my briefing/ }));
    expect(screen.getByText("Say in a few words what the meeting is about.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("What is the meeting about?"), { target: { value: "Hackathon judging" } });
    fireEvent.click(screen.getByRole("button", { name: /Prepare my briefing/ }));
    const target = String(push.mock.calls[0]?.[0]);
    const input = readBriefingSearchParams(Object.fromEntries(new URLSearchParams(target.split("?")[1])));
    expect(input).toMatchObject({ meetingType: "other", meetingTopic: "Hackathon judging" });
  });

  it("sets the time from an imported invite and offers its people to add", async () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    const invite = ["BEGIN:VEVENT", "DTSTART:20261119T100000Z", "SUMMARY:Quarterly review", "ATTENDEE;CN=Jonas Weber:mailto:jonas@harbor-capital.example", "END:VEVENT"].join("\r\n");
    fireEvent.change(screen.getByLabelText("Import invite"), { target: { files: [new File([invite], "invite.ics", { type: "text/calendar" })] } });
    expect(await screen.findByText(/Imported “Quarterly review”\. The time is set from it\./)).toBeTruthy();
    expect((screen.getByLabelText("Meeting date and time") as HTMLInputElement).value).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Jonas Weber · Harbor Capital" }));
    expect(nameField().value).toBe("Jonas Weber");
    expect(document.activeElement).toBe(nameField());
    expect(screen.getByLabelText("Type")).toHaveProperty("value", "person");
    expect(screen.getByLabelText("Their company, optional")).toHaveProperty("value", "Harbor Capital");
  });

  it("says so when a file holds no meeting", async () => {
    render(<BriefingForm initialInput={null} notice={null} />);
    fireEvent.change(screen.getByLabelText("Import invite"), { target: { files: [new File(["hello"], "notes.ics")] } });
    expect(await screen.findByText(/No meeting found in that file/)).toBeTruthy();
  });
});
