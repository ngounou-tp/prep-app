import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBriefingRequest, type BriefingRequestDependencies } from "@/lib/http/briefingRequest";
import { meeting, NOW } from "@/tests/support/briefingScenario";
import { createSubjectRateLimiter } from "@/lib/http/rateLimit";
import { makeSubject } from "@/tests/support/testDoubles";

const northwind = makeSubject("c1", "Northwind Freight", "company");

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/briefing", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1", ...headers },
    body,
  });
}

function companies(count: number) {
  return Array.from({ length: count }, (_, index) => makeSubject(`c${index}`, `Company ${index}`, "company"));
}

function dependencies(): BriefingRequestDependencies {
  // These tests stop before the pipeline; a request that gets that far ends in an error line.
  const createBriefing = vi.fn<BriefingRequestDependencies["createBriefing"]>(() => Promise.reject(new Error("not used here")));
  return { limiter: createSubjectRateLimiter(), createBriefing, now: () => NOW };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleBriefingRequest checks", () => {
  it("rejects a non-JSON content type with 415", async () => {
    const response = await handleBriefingRequest(post("name=x", { "content-type": "application/x-www-form-urlencoded" }), dependencies());
    expect(response.status).toBe(415);
  });

  it("rejects a body over 8 KB with 413, whatever Content-Length says", async () => {
    const big = JSON.stringify({ ...meeting([northwind]), padding: "x".repeat(9000) });
    expect((await handleBriefingRequest(post(big), dependencies())).status).toBe(413);
    expect((await handleBriefingRequest(post(big, { "content-length": "10" }), dependencies())).status).toBe(413);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await handleBriefingRequest(post("{not json"), dependencies());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The request is not valid JSON." });
  });

  it("returns field-level messages that are safe to show", async () => {
    const input = { ...meeting([{ ...northwind, name: "N".repeat(121) }]), meetingAt: "next week", meetingType: "lunch" };
    const response = await handleBriefingRequest(post(JSON.stringify(input)), dependencies());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Some fields need attention.",
      fields: [
        { path: "meetingAt", message: "Enter a valid meeting date and time." },
        { path: "meetingType", message: "Choose one of the listed options." },
        { path: "subjects.0.name", message: "Keep this under 120 characters." },
      ],
    });
  });

  it("rejects six subjects", async () => {
    const response = await handleBriefingRequest(post(JSON.stringify(meeting(companies(6)))), dependencies());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fields: [{ path: "subjects", message: "Add at most 5 people and companies." }] });
  });

  it("limits by subjects: after 15 in the window the next request gets 429 with Retry-After", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shared = dependencies();
    const five = JSON.stringify(meeting(companies(5)));
    for (let request = 0; request < 3; request += 1) {
      expect((await handleBriefingRequest(post(five), shared)).status).toBe(200);
    }
    const refused = await handleBriefingRequest(post(JSON.stringify(meeting([northwind]))), shared);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("600");
    expect(await refused.json()).toEqual({ error: "Too many briefings from this connection. Try again later." });
    const otherAddress = await handleBriefingRequest(post(five, { "x-forwarded-for": "198.51.100.4" }), shared);
    expect(otherAddress.status).toBe(200);
  });
});
