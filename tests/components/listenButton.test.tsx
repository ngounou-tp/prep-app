// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenButton } from "@/components/result/ListenButton";
import { buildBriefing, company, fixtureClaim } from "@/tests/support/briefingFixture";

const briefing = buildBriefing({ subjects: [company("c1", "Northwind Freight")], claims: [fixtureClaim("C1", ["c1"])] });

// jsdom has no speech, so the test stands in a small fake that records what would be said.
class FakeUtterance {
  lang = "";
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSpeech() {
  return { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() };
}

let speech = fakeSpeech();

beforeEach(() => {
  speech = fakeSpeech();
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", { value: speech, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("ListenButton", () => {
  it("reads every passage, then pauses, resumes and stops", () => {
    render(<ListenButton briefing={briefing} />);
    fireEvent.click(screen.getByRole("button", { name: /Listen · about 1 min/ }));
    const spoken = speech.speak.mock.calls.map(([utterance]) => (utterance as FakeUtterance).text);
    expect(spoken[0]).toMatch(/^Briefing for your sales call/);
    expect(spoken.at(-1)).toBe("Question 1, for Northwind Freight: What changed after C1?");
    expect(screen.getByRole("status").textContent).toBe("Reading the briefing aloud.");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(speech.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(speech.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: /Listen/ })).toBeTruthy();
  });

  it("stops speaking when the page leaves", () => {
    const { unmount } = render(<ListenButton briefing={briefing} />);
    fireEvent.click(screen.getByRole("button", { name: /Listen/ }));
    speech.cancel.mockClear();
    unmount();
    expect(speech.cancel).toHaveBeenCalled();
  });

  it("shows nothing where the browser cannot speak", () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    const { container } = render(<ListenButton briefing={briefing} />);
    expect(container.innerHTML).toBe("");
  });
});
