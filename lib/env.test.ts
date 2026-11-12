import { describe, expect, it } from "vitest";
import { readEnvironment } from "@/lib/env";

const validSource = {
  TAVILY_API_KEY: "test-key-not-real",
  BIFROST_URL: "http://localhost:8080",
  BIFROST_MODEL: "test-model",
};

describe("readEnvironment", () => {
  it("returns the three variables when all are valid", () => {
    expect(readEnvironment(validSource)).toEqual(validSource);
  });

  it("names a missing variable in the error", () => {
    const withoutKey = {
      BIFROST_URL: validSource.BIFROST_URL,
      BIFROST_MODEL: validSource.BIFROST_MODEL,
    };
    expect(() => readEnvironment(withoutKey)).toThrow("TAVILY_API_KEY is missing");
  });

  it("treats an empty value as missing", () => {
    expect(() => readEnvironment({ ...validSource, BIFROST_MODEL: "  " })).toThrow(
      "BIFROST_MODEL is missing",
    );
  });

  it("rejects a non-http url without echoing the value", () => {
    const action = () => readEnvironment({ ...validSource, BIFROST_URL: "ftp://secret-host" });
    expect(action).toThrow("BIFROST_URL is not valid");
    expect(action).not.toThrow("secret-host");
  });
});
