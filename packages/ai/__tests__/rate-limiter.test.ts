/**
 * Tests for rate-limiter: TokenBucket, TokenBudget, RateLimiter, createRateLimitedModel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TokenBucket,
  TokenBudget,
  RateLimiter,
  createRateLimitedModel,
} from "../src/rate-limiter.js";
import { RateLimitError, TimeoutError } from "../src/errors.js";
import type { Model, ModelRequestOptions } from "../src/index.js";
import type { Message, ModelResponse, ToolDefinition } from "../src/types.js";
import type { StreamResult } from "../src/stream.js";
import { streamFromArray } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockModel(responses?: ModelResponse[]): Model {
  let callIndex = 0;
  const defaultResponse: ModelResponse = {
    text: "Hello",
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: "stop",
  };

  return {
    modelId: "mock:test-model",
    async generate(): Promise<ModelResponse> {
      if (responses && callIndex < responses.length) {
        return responses[callIndex++];
      }
      return defaultResponse;
    },
    async stream(): Promise<StreamResult> {
      return streamFromArray([{ type: "text_delta", text: "test" }, { type: "done" }]);
    },
    async generateWithTools(): Promise<ModelResponse> {
      if (responses && callIndex < responses.length) {
        return responses[callIndex++];
      }
      return defaultResponse;
    },
  };
}

// ---------------------------------------------------------------------------
// TokenBucket tests
// ---------------------------------------------------------------------------

describe("TokenBucket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start with maxTokens available", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.available).toBe(5);
  });

  it("should consume tokens", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.consume()).toBe(true);
    expect(bucket.available).toBe(4);
  });

  it("should consume multiple tokens at once", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.consume(3)).toBe(true);
    expect(bucket.available).toBe(2);
  });

  it("should return false when bucket is empty", () => {
    const bucket = new TokenBucket({ maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
    expect(bucket.available).toBe(0);
  });

  it("should refill tokens after interval", () => {
    const bucket = new TokenBucket({ maxTokens: 3, refillRate: 1, refillIntervalMs: 1000 });
    bucket.consume(3);
    expect(bucket.available).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(bucket.available).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(bucket.available).toBe(3); // capped at maxTokens
  });

  it("should refill multiple tokens per interval based on refillRate", () => {
    const bucket = new TokenBucket({ maxTokens: 10, refillRate: 3, refillIntervalMs: 1000 });
    bucket.consume(10);
    expect(bucket.available).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(bucket.available).toBe(3);

    vi.advanceTimersByTime(1000);
    expect(bucket.available).toBe(6);
  });

  it("should not exceed maxTokens on refill", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 10, refillIntervalMs: 1000 });
    bucket.consume(1);
    expect(bucket.available).toBe(4);

    vi.advanceTimersByTime(1000);
    expect(bucket.available).toBe(5); // capped
  });

  it("should calculate wait time correctly", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    bucket.consume(5);
    expect(bucket.waitTime()).toBe(1000);
    expect(bucket.waitTime(3)).toBe(3000);
  });

  it("should return 0 wait time when tokens are available", () => {
    const bucket = new TokenBucket({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 });
    expect(bucket.waitTime()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TokenBudget tests
// ---------------------------------------------------------------------------

describe("TokenBudget", () => {
  it("should start with full budget", () => {
    const budget = new TokenBudget(1000);
    expect(budget.remaining).toBe(1000);
    expect(budget.consumed).toBe(0);
  });

  it("should track consumed tokens", () => {
    const budget = new TokenBudget(1000);
    budget.record(100);
    expect(budget.consumed).toBe(100);
    expect(budget.remaining).toBe(900);
  });

  it("should accumulate usage across multiple records", () => {
    const budget = new TokenBudget(1000);
    budget.record(100);
    budget.record(200);
    budget.record(300);
    expect(budget.consumed).toBe(600);
    expect(budget.remaining).toBe(400);
  });

  it("should throw RateLimitError when budget exceeded", () => {
    const budget = new TokenBudget(100);
    budget.record(90);
    expect(() => budget.record(20)).toThrow(RateLimitError);
    // Consumed should not have changed after rejection
    expect(budget.consumed).toBe(90);
  });

  it("should allow recording up to exact limit", () => {
    const budget = new TokenBudget(100);
    budget.record(100);
    expect(budget.consumed).toBe(100);
    expect(budget.remaining).toBe(0);
  });

  it("should reset the counter", () => {
    const budget = new TokenBudget(100);
    budget.record(80);
    budget.reset();
    expect(budget.consumed).toBe(0);
    expect(budget.remaining).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// RateLimiter tests
// ---------------------------------------------------------------------------

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should pass through requests when tokens are available", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    const result = await limiter.generate([{ role: "user", content: "Hi" }]);
    expect(result.text).toBe("Hello");
  });

  it("should preserve modelId from inner model", () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    expect(limiter.modelId).toBe("mock:test-model");
  });

  it("should rate limit generateWithTools", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 1,
      refillRate: 1,
      refillIntervalMs: 100,
    });

    const tools: ToolDefinition[] = [{
      name: "test",
      description: "test tool",
      parameters: { type: "object" },
    }];

    const result = await limiter.generateWithTools(
      [{ role: "user", content: "Hi" }],
      tools,
    );
    expect(result.text).toBe("Hello");
  });

  it("should rate limit stream", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 1,
      refillRate: 1,
      refillIntervalMs: 100,
    });

    const stream = await limiter.stream([{ role: "user", content: "Hi" }]);
    expect(stream).toBeDefined();
  });

  it("should queue requests when bucket is empty", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 1,
      refillRate: 1,
      refillIntervalMs: 100,
    });

    // First request consumes the token
    const p1 = limiter.generate([{ role: "user", content: "First" }]);
    // Second request should be queued
    const p2 = limiter.generate([{ role: "user", content: "Second" }]);

    expect(limiter.queueSize).toBe(1);

    // Resolve first request
    const r1 = await p1;
    expect(r1.text).toBe("Hello");

    // Advance time to refill a token
    vi.advanceTimersByTime(100);

    const r2 = await p2;
    expect(r2.text).toBe("Hello");
    expect(limiter.queueSize).toBe(0);
  });

  it("should timeout queued requests when timeoutMs is set", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 1,
      refillRate: 1,
      refillIntervalMs: 10000,
      timeoutMs: 500,
    });

    // Consume the only token
    await limiter.generate([{ role: "user", content: "First" }]);

    // This should queue and eventually timeout
    const p = limiter.generate([{ role: "user", content: "Second" }]);

    vi.advanceTimersByTime(500);

    await expect(p).rejects.toThrow(TimeoutError);
    await expect(p).rejects.toThrow("Rate limiter timed out after 500ms");
  });

  it("should track token budget on generate", async () => {
    const budget = new TokenBudget(50);
    const model = createMockModel([
      {
        text: "Response 1",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: "stop",
      },
      {
        text: "Response 2",
        toolCalls: [],
        usage: { promptTokens: 15, completionTokens: 15, totalTokens: 30 },
        finishReason: "stop",
      },
      {
        text: "Response 3",
        toolCalls: [],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
      },
    ]);

    const limiter = createRateLimitedModel(model, {
      maxTokens: 10,
      refillRate: 10,
      refillIntervalMs: 100,
      tokenBudget: budget,
    });

    await limiter.generate([{ role: "user", content: "1" }]);
    expect(budget.consumed).toBe(20);

    await limiter.generate([{ role: "user", content: "2" }]);
    expect(budget.consumed).toBe(50);

    // Third call should exceed budget
    await expect(
      limiter.generate([{ role: "user", content: "3" }]),
    ).rejects.toThrow(RateLimitError);
  });

  it("should track token budget on generateWithTools", async () => {
    const budget = new TokenBudget(20);
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 10,
      refillRate: 10,
      refillIntervalMs: 100,
      tokenBudget: budget,
    });

    const tools: ToolDefinition[] = [{
      name: "test",
      description: "test",
      parameters: { type: "object" },
    }];

    await limiter.generateWithTools([{ role: "user", content: "1" }], tools);
    expect(budget.consumed).toBe(15); // default mock usage is 15 total
  });

  it("should expose queueSize", () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });
    expect(limiter.queueSize).toBe(0);
  });

  it("should expose tokenBucket", () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });
    expect(limiter.tokenBucket).toBeInstanceOf(TokenBucket);
    expect(limiter.tokenBucket.available).toBe(5);
  });

  it("should dispose and reject queued requests", async () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 1,
      refillRate: 1,
      refillIntervalMs: 10000,
    });

    // Consume the token
    await limiter.generate([{ role: "user", content: "First" }]);

    // Queue a request
    const p = limiter.generate([{ role: "user", content: "Second" }]);

    limiter.dispose();

    await expect(p).rejects.toThrow("Rate limiter disposed");
  });
});

// ---------------------------------------------------------------------------
// createRateLimitedModel factory tests
// ---------------------------------------------------------------------------

describe("createRateLimitedModel", () => {
  it("should return a RateLimiter instance", () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });
    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it("should implement the Model interface", () => {
    const model = createMockModel();
    const limiter = createRateLimitedModel(model, {
      maxTokens: 5,
      refillRate: 1,
      refillIntervalMs: 1000,
    });

    expect(limiter.modelId).toBe("mock:test-model");
    expect(typeof limiter.generate).toBe("function");
    expect(typeof limiter.stream).toBe("function");
    expect(typeof limiter.generateWithTools).toBe("function");
  });
});
