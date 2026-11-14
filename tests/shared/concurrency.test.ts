import { describe, expect, it } from "vitest";
import { createLimiter } from "@/lib/shared/concurrency";

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("createLimiter", () => {
  it("never runs more tasks at once than the limit, and runs them all", async () => {
    const limit = createLimiter(3);
    let active = 0;
    let highest = 0;
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        limit(async () => {
          active += 1;
          highest = Math.max(highest, active);
          await pause(5);
          active -= 1;
          return index;
        }),
      ),
    );
    expect(highest).toBe(3);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("frees the slot when a task fails", async () => {
    const limit = createLimiter(1);
    const outcomes = await Promise.allSettled([
      limit(() => Promise.reject(new Error("search failed"))),
      limit(() => Promise.resolve("next task ran")),
    ]);
    expect(outcomes[0]?.status).toBe("rejected");
    expect(outcomes[1]).toEqual({ status: "fulfilled", value: "next task ran" });
  });
});
