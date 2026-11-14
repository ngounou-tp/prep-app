import { describe, expect, it } from "vitest";
import { readEnvironment } from "@/lib/config/env";

const validSource = {
  TAVILY_API_KEY: "test-key-not-real",
  BIFROST_URL: "http://localhost:8080",
  BIFROST_MODEL: "test-provider/test-model",
};

describe("readEnvironment", () => {
  it("returns the required variables and the defaults for optional settings", () => {
    expect(readEnvironment(validSource)).toEqual({
      ...validSource,
      BIFROST_API_KEY: undefined,
      BIFROST_FALLBACK_MODELS: [],
      LLM_CONCURRENCY: 1,
      LLM_PAUSE_MS: 1000,
      MAX_SOURCES_PER_SUBJECT: 8,
      SOURCE_CHARS: 800,
    });
  });

  it("reads optional settings, treating blank values as unset", () => {
    const environment = readEnvironment({
      ...validSource,
      BIFROST_API_KEY: "  ",
      BIFROST_FALLBACK_MODELS: " provider-a/model-one , provider-b/model-two:latest ,",
      LLM_CONCURRENCY: "2",
      LLM_PAUSE_MS: "",
    });
    expect(environment.BIFROST_API_KEY).toBeUndefined();
    expect(environment.BIFROST_FALLBACK_MODELS).toEqual(["provider-a/model-one", "provider-b/model-two:latest"]);
    expect(environment.LLM_CONCURRENCY).toBe(2);
    expect(environment.LLM_PAUSE_MS).toBe(1000);
  });

  it("names a missing variable in the error", () => {
    const withoutKey = {
      BIFROST_URL: validSource.BIFROST_URL,
      BIFROST_MODEL: validSource.BIFROST_MODEL,
    };
    expect(() => readEnvironment(withoutKey)).toThrow("TAVILY_API_KEY is missing");
  });

  it("treats an empty required value as missing", () => {
    expect(() => readEnvironment({ ...validSource, TAVILY_API_KEY: "  " })).toThrow("TAVILY_API_KEY is missing");
  });

  it("uses automatic model choice when BIFROST_MODEL is blank, unset or auto", () => {
    expect(readEnvironment({ ...validSource, BIFROST_MODEL: "  " }).BIFROST_MODEL).toBe("auto");
    expect(readEnvironment({ TAVILY_API_KEY: "test-key-not-real", BIFROST_URL: "http://localhost:8080" }).BIFROST_MODEL).toBe("auto");
    expect(readEnvironment({ ...validSource, BIFROST_MODEL: "AUTO" }).BIFROST_MODEL).toBe("auto");
    expect(readEnvironment({ ...validSource, BIFROST_FALLBACK_MODELS: "auto" }).BIFROST_FALLBACK_MODELS).toBe("auto");
  });

  it("rejects a non-http url without echoing the value", () => {
    const action = () => readEnvironment({ ...validSource, BIFROST_URL: "ftp://secret-host" });
    expect(action).toThrow("BIFROST_URL is not valid");
    expect(action).not.toThrow("secret-host");
  });

  it("rejects out-of-range numbers and malformed fallback ids", () => {
    expect(() => readEnvironment({ ...validSource, MAX_SOURCES_PER_SUBJECT: "20" })).toThrow(
      "MAX_SOURCES_PER_SUBJECT is not valid",
    );
    expect(() => readEnvironment({ ...validSource, LLM_CONCURRENCY: "two" })).toThrow("LLM_CONCURRENCY is not valid");
    expect(() => readEnvironment({ ...validSource, BIFROST_FALLBACK_MODELS: "no-slash" })).toThrow(
      "BIFROST_FALLBACK_MODELS is not valid",
    );
  });
});
