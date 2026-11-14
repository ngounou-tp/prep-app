import { describe, expect, it, vi } from "vitest";
import { WAKE_INTERVAL_MILLISECONDS, createWakeHandler } from "@/lib/http/wakeRequest";

vi.mock("server-only", () => ({}));

describe("createWakeHandler", () => {
  it("answers at once and wakes the gateway at most once a minute", () => {
    let time = 1_000_000;
    const wake = vi.fn(async () => true);
    const handle = createWakeHandler(wake, () => time);
    expect(handle().status).toBe(202);
    expect(handle().status).toBe(202);
    expect(wake).toHaveBeenCalledTimes(1);
    time += WAKE_INTERVAL_MILLISECONDS;
    handle();
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("logs a failed wake-up without failing the request", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handle = createWakeHandler(async () => {
      throw new Error("Environment configuration error: BIFROST_URL is missing");
    });
    expect(handle().status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logged).toHaveBeenCalledWith("Could not wake the model gateway: the server settings are incomplete");
    logged.mockRestore();
  });
});
