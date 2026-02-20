/**
 * Tests for retry and fallback logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  withRetry,
  defaultIsRetryable,
  createFallback,
  FallbackProvider,
} from "../src/retry.js";
import type { ModelProvider, ProviderRequestOptions } from "../src/provider.js";
import type { Message, ModelResponse, ModelCapabilities } from "../src/types.js";
import type { StreamResult } from "../src/stream.js";
import { streamFromArray } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(
  name: string,
  overrides?: {
    generate?: (messages: Message[], options: ProviderRequestOptions) => Promise<ModelResponse>;
  },
): ModelProvider {
  const capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  return {
    name,
    capabilities,
    async generate(messages: Message[], options: ProviderRequestOptions): Promise<ModelResponse> {
      if (overrides?.generate) return overrides.generate(messages, options);
      return {
        text: `Response from ${name}`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
    async stream(_messages: Message[], _options: ProviderRequestOptions): Promise<StreamResult> {
      return streamFromArray([{ type: "text_delta", text: "test" }, { type: "done" }]);
    },
    async generateWithTools(_messages, _tools, _options): Promise<ModelResponse> {
      return {
        text: "Tool response",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error and succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 rate limit"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("429 rate limit"));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 1 }),
    ).rejects.toThrow("429 rate limit");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should not retry on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid API key"));

    await expect(
      withRetry(fn, { maxRetries: 3, initialDelayMs: 1 }),
    ).rejects.toThrow("Invalid API key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should respect custom isRetryable", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("custom error"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 1,
      isRetryable: (err) => err instanceof Error && err.message === "custom error",
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("defaultIsRetryable", () => {
  it("should return true for rate limit errors", () => {
    expect(defaultIsRetryable(new Error("429 rate limit"))).toBe(true);
    expect(defaultIsRetryable(new Error("Rate limit exceeded"))).toBe(true);
  });

  it("should return true for server errors", () => {
    expect(defaultIsRetryable(new Error("500 internal server error"))).toBe(true);
    expect(defaultIsRetryable(new Error("502 bad gateway"))).toBe(true);
    expect(defaultIsRetryable(new Error("503 service unavailable"))).toBe(true);
    expect(defaultIsRetryable(new Error("504 gateway timeout"))).toBe(true);
  });

  it("should return true for connection errors", () => {
    expect(defaultIsRetryable(new Error("ECONNRESET"))).toBe(true);
    expect(defaultIsRetryable(new Error("ECONNREFUSED"))).toBe(true);
    expect(defaultIsRetryable(new Error("Request timeout"))).toBe(true);
  });

  it("should return true for errors with status code property", () => {
    const error429 = Object.assign(new Error("Too many requests"), { status: 429 });
    expect(defaultIsRetryable(error429)).toBe(true);

    const error500 = Object.assign(new Error("Server error"), { statusCode: 500 });
    expect(defaultIsRetryable(error500)).toBe(true);
  });

  it("should return false for client errors", () => {
    expect(defaultIsRetryable(new Error("Invalid API key"))).toBe(false);
    expect(defaultIsRetryable(new Error("Bad request"))).toBe(false);

    const error400 = Object.assign(new Error("Bad request"), { status: 400 });
    expect(defaultIsRetryable(error400)).toBe(false);
  });

  it("should return false for non-Error values", () => {
    expect(defaultIsRetryable("string error")).toBe(false);
    expect(defaultIsRetryable(null)).toBe(false);
    expect(defaultIsRetryable(undefined)).toBe(false);
  });
});

describe("FallbackProvider", () => {
  it("should throw if no providers given", () => {
    expect(() => new FallbackProvider([])).toThrow(
      "FallbackProvider requires at least one provider",
    );
  });

  it("should use the first provider if it succeeds", async () => {
    const primary = createMockProvider("primary");
    const secondary = createMockProvider("secondary");
    const fallback = createFallback([primary, secondary]);

    const result = await fallback.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );
    expect(result.text).toBe("Response from primary");
  });

  it("should fall back to second provider on failure", async () => {
    const primary = createMockProvider("primary", {
      generate: () => Promise.reject(new Error("Primary failed")),
    });
    const secondary = createMockProvider("secondary");
    const fallback = createFallback([primary, secondary], {
      retryOptions: { maxRetries: 0 },
    });

    const result = await fallback.generate(
      [{ role: "user", content: "test" }],
      { modelName: "test-model" },
    );
    expect(result.text).toBe("Response from secondary");
  });

  it("should throw if all providers fail", async () => {
    const p1 = createMockProvider("p1", {
      generate: () => Promise.reject(new Error("P1 failed")),
    });
    const p2 = createMockProvider("p2", {
      generate: () => Promise.reject(new Error("P2 failed")),
    });
    const fallback = createFallback([p1, p2], {
      retryOptions: { maxRetries: 0 },
    });

    await expect(
      fallback.generate(
        [{ role: "user", content: "test" }],
        { modelName: "test-model" },
      ),
    ).rejects.toThrow("P2 failed");
  });

  it("should have a descriptive name", () => {
    const fallback = createFallback([
      createMockProvider("openai"),
      createMockProvider("anthropic"),
    ]);
    expect(fallback.name).toBe("fallback(openai,anthropic)");
  });

  it("should expose capabilities of primary provider", () => {
    const primary = createMockProvider("primary");
    const fallback = createFallback([primary]);
    expect(fallback.capabilities).toEqual(primary.capabilities);
  });
});
