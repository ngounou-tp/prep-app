import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModelClient } from "@/lib/model/llm";
import { completion, jsonResponse, recordingPause, stubBifrost, TEST_ENVIRONMENT } from "@/tests/support/testDoubles";

const answerSchema = z.object({ answer: z.string() });
const VALID = '{"answer": "yes"}';

function rateLimited(retryAfterMilliseconds?: number): Response {
  const extraFields = retryAfterMilliseconds === undefined ? undefined : { retry_after_ms: retryAfterMilliseconds };
  return jsonResponse({ error: { message: "rate limited" }, extra_fields: extraFields }, 429);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chatJson", () => {
  it("succeeds on the second attempt after output with no JSON", async () => {
    const replies = ["Sorry, I cannot format that.", VALID];
    const fetchMock = stubBifrost(() => completion(replies.shift() ?? ""));
    const result = await createModelClient(TEST_ENVIRONMENT).chatJson("system", "user", answerSchema);
    expect(result).toMatchObject({ ok: true, value: { answer: "yes" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails after two attempts whose JSON does not match the schema", async () => {
    const fetchMock = stubBifrost(() => completion('{"answer": 42}'));
    const result = await createModelClient(TEST_ENVIRONMENT).chatJson("system", "user", answerSchema);
    expect(result).toEqual({ ok: false, failure: "invalid-output" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when Bifrost itself fails", async () => {
    const fetchMock = stubBifrost(() => jsonResponse({}, 503));
    const result = await createModelClient(TEST_ENVIRONMENT).chatJson("system", "user", answerSchema);
    expect(result).toEqual({ ok: false, failure: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits the hinted time after a 429 and tries once more", async () => {
    const responses = [rateLimited(3000), completion(VALID)];
    stubBifrost(() => responses.shift() ?? completion(VALID));
    const { pause, waits } = recordingPause();
    const result = await createModelClient(TEST_ENVIRONMENT, pause).chatJson("system", "user", answerSchema);
    expect(result.ok).toBe(true);
    expect(waits).toEqual([3000]);
  });

  it("caps the wait at 15 seconds and reports a rate limit when the retry is limited too", async () => {
    const fetchMock = stubBifrost(() => rateLimited(60_000));
    const { pause, waits } = recordingPause();
    const result = await createModelClient(TEST_ENVIRONMENT, pause).chatJson("system", "user", answerSchema);
    expect(result).toEqual({ ok: false, failure: "rate-limit" });
    expect(waits).toEqual([15_000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("waits 5 seconds when the 429 gives no hint", async () => {
    const responses = [rateLimited(), completion(VALID)];
    stubBifrost(() => responses.shift() ?? completion(VALID));
    const { pause, waits } = recordingPause();
    await createModelClient(TEST_ENVIRONMENT, pause).chatJson("system", "user", answerSchema);
    expect(waits).toEqual([5000]);
  });
});

describe("the model queue", () => {
  it("runs one call at a time with LLM_CONCURRENCY 1 and pauses LLM_PAUSE_MS between calls", async () => {
    let active = 0;
    let highest = 0;
    stubBifrost(async () => {
      active += 1;
      highest = Math.max(highest, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return completion(VALID);
    });
    const { pause, waits } = recordingPause();
    const client = createModelClient({ ...TEST_ENVIRONMENT, LLM_CONCURRENCY: 1, LLM_PAUSE_MS: 1000 }, pause);
    await Promise.all([1, 2, 3].map(() => client.chatJson("system", "user", answerSchema)));
    expect(highest).toBe(1);
    expect(waits).toHaveLength(2);
    expect(waits.every((milliseconds) => milliseconds > 900 && milliseconds <= 1000)).toBe(true);
  });

  it("allows parallel calls up to a higher LLM_CONCURRENCY", async () => {
    let active = 0;
    let highest = 0;
    stubBifrost(async () => {
      active += 1;
      highest = Math.max(highest, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return completion(VALID);
    });
    const client = createModelClient({ ...TEST_ENVIRONMENT, LLM_CONCURRENCY: 3 });
    await Promise.all([1, 2, 3, 4, 5].map(() => client.chatJson("system", "user", answerSchema)));
    expect(highest).toBe(3);
  });
});
