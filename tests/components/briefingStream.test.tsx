// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBriefingStream } from "@/components/progress/useBriefingStream";
import type { StreamOutcome } from "@/lib/client/streamBriefing";
import type { BriefingInput } from "@/lib/types";
import { buildBriefing, company, fixtureClaim } from "@/tests/support/briefingFixture";

const { streamBriefing } = vi.hoisted(() => ({ streamBriefing: vi.fn() }));
vi.mock("@/lib/client/streamBriefing", () => ({ streamBriefing }));

type Call = { finish: (outcome: StreamOutcome) => void; signal: AbortSignal };
let calls: Call[] = [];

const northwind = company("c1", "Northwind Freight");
const input: BriefingInput = { meetingAt: "2026-11-19T10:00:00.000Z", meetingType: "sales-call", meetingTopic: undefined, subjects: [northwind] };
const briefing = buildBriefing({ subjects: [northwind], claims: [fixtureClaim("C1", ["c1"])] });

function Probe({ request }: { request: BriefingInput }) {
  const { run } = useBriefingStream(request);
  return <p data-testid="phase">{run.phase}</p>;
}

// Next.js hides a page the user leaves instead of unmounting it; Activity does the same here.
function Page({ visible, request = input }: { visible: boolean; request?: BriefingInput }) {
  return (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Probe request={request} />
    </Activity>
  );
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));
const phase = () => screen.getByTestId("phase").textContent;

beforeEach(() => {
  calls = [];
  streamBriefing.mockImplementation(
    (_input: BriefingInput, _onEvent: unknown, options: { signal: AbortSignal }) =>
      new Promise<StreamOutcome>((resolve) => {
        options.signal.addEventListener("abort", () => resolve({ kind: "cancelled" }));
        calls.push({ finish: resolve, signal: options.signal });
      }),
  );
});

afterEach(() => {
  cleanup();
  streamBriefing.mockReset();
});

describe("useBriefingStream", () => {
  it("sends one request, even when the page re-renders with an equal input", async () => {
    const { rerender } = render(<Page visible />);
    await settle();
    rerender(<Page visible request={{ ...input }} />);
    await settle();
    expect(calls).toHaveLength(1);
  });

  it("shows a finished briefing again without asking the server again", async () => {
    const { rerender } = render(<Page visible />);
    await settle();
    await act(async () => calls[0]?.finish({ kind: "result", briefing }));
    expect(phase()).toBe("result");
    rerender(<Page visible={false} />);
    await settle();
    rerender(<Page visible />);
    await settle();
    expect(calls).toHaveLength(1);
    expect(phase()).toBe("result");
  });

  it("cancels a run the user leaves, and starts it over on a clean screen when they return", async () => {
    const { rerender } = render(<Page visible />);
    await settle();
    rerender(<Page visible={false} />);
    await settle();
    expect(calls[0]?.signal.aborted).toBe(true);
    rerender(<Page visible />);
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1]?.signal.aborted).toBe(false);
    expect(phase()).toBe("running");
  });
});
