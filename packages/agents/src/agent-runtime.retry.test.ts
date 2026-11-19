import { describe, expect, it } from "vitest";
import { isTransientProviderError } from "./agent-runtime";

describe("transient provider error classification", () => {
  it("classifies network drops and 5xx/429 failures as retryable", () => {
    for (const message of [
      "ECONNRESET: socket closed",
      "fetch failed",
      "HTTP 429 rate limit exceeded",
      "503 Service Unavailable",
      "ETIMEDOUT",
    ]) {
      expect(isTransientProviderError(message)).toBe(true);
    }
  });

  it("does not retry authentication or malformed-output failures", () => {
    for (const message of [
      "Incorrect API key provided",
      "Invalid tool arguments",
      "Model output must contain text or tool calls",
    ]) {
      expect(isTransientProviderError(message)).toBe(false);
    }
  });
});
