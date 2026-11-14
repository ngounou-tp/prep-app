import { describe, expect, it, vi } from "vitest";
import { requestGatewayWake } from "@/lib/client/wakeGateway";

describe("requestGatewayWake", () => {
  it("asks the server to wake the gateway and reports whether it agreed", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await requestGatewayWake(fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("/api/wake", { method: "POST" });
  });

  it("reports a network failure as false instead of throwing", async () => {
    expect(await requestGatewayWake(async () => Promise.reject(new TypeError("offline")))).toBe(false);
  });
});
