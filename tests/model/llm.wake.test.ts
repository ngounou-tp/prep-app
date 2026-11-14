import { afterEach, describe, expect, it, vi } from "vitest";
import { readEnvironment } from "@/lib/config/env";
import { wakeGateway } from "@/lib/model/llm";

vi.mock("server-only", () => ({}));

const environment = readEnvironment({
  TAVILY_API_KEY: "tvly-test",
  BIFROST_URL: "https://gateway.example/",
  BIFROST_API_KEY: "sk-bf-test",
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("wakeGateway", () => {
  it("asks the gateway's health endpoint, without sending the key", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await wakeGateway(environment)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gateway.example/health");
    expect(init.headers).toEqual({});
  });

  it("reports an unreachable gateway as false", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await wakeGateway(environment)).toBe(false);
  });
});
