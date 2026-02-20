/**
 * Tests for built-in middlewares: logging, caching, cost-tracking.
 */

import { describe, it, expect, vi } from "vitest";
import { createAgent } from "../src/index.js";
import {
  createLoggingMiddleware,
  createCachingMiddleware,
  createCostTrackingMiddleware,
} from "../src/middlewares/index.js";
import type { ToolDefinition } from "../src/types.js";
import type { Model, Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Mock model helper
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;
  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Stream not implemented in mock");
    },
    async generateWithTools(
      _messages: Message[],
      _tools: AIToolDef[],
    ): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
  };
}

// ---------------------------------------------------------------------------
// Logging middleware
// ---------------------------------------------------------------------------

describe("createLoggingMiddleware", () => {
  it("should log beforeGenerate and afterGenerate", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "log-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hi");

    expect(logs.some((l) => l.includes("beforeGenerate"))).toBe(true);
    expect(logs.some((l) => l.includes("afterGenerate"))).toBe(true);
  });

  it("should log tool calls", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });

    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "search", arguments: { q: "test" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Found it.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const tool: ToolDefinition = {
      name: "search",
      description: "Search",
      parameters: { type: "object", properties: { q: { type: "string" } } },
      execute: async () => "results",
    };

    const agent = createAgent({
      name: "log-tool-agent",
      model,
      systemPrompt: "Test.",
      tools: [tool],
      middlewares: [mw],
    });

    await agent.run("Search");

    expect(logs.some((l) => l.includes("beforeToolCall") && l.includes("search"))).toBe(true);
    expect(logs.some((l) => l.includes("afterToolCall") && l.includes("search"))).toBe(true);
  });

  it("should log errors", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });

    const model = createMockModel([]);
    model.generate = async () => {
      throw new Error("Model crashed");
    };

    const agent = createAgent({
      name: "log-error-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await expect(agent.run("fail")).rejects.toThrow("Model crashed");
    expect(logs.some((l) => l.includes("onError") && l.includes("Model crashed"))).toBe(true);
  });

  it("should include timing info when timing is enabled", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: true,
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "timing-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hi");

    const afterLog = logs.find((l) => l.includes("afterGenerate"));
    expect(afterLog).toBeDefined();
    // Timing should show "(Xms)" pattern
    expect(afterLog).toMatch(/\(\d+ms\)/);
  });

  it("should use custom prefix", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      prefix: "[custom]",
      timing: false,
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "prefix-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hi");
    expect(logs.every((l) => l.startsWith("[custom]"))).toBe(true);
  });

  it("should log tool error in afterToolCall", async () => {
    const logs: string[] = [];
    const mw = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });

    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "fail_tool", arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Tool failed.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const failTool: ToolDefinition = {
      name: "fail_tool",
      description: "Fails",
      parameters: { type: "object" },
      execute: async () => { throw new Error("tool broke"); },
    };

    const agent = createAgent({
      name: "fail-tool-log-agent",
      model,
      systemPrompt: "Test.",
      tools: [failTool],
      middlewares: [mw],
    });

    await agent.run("fail");
    expect(logs.some((l) => l.includes("ERROR") && l.includes("tool broke"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Caching middleware
// ---------------------------------------------------------------------------

describe("createCachingMiddleware", () => {
  it("should start with empty cache", () => {
    const mw = createCachingMiddleware();
    expect(mw.cacheSize).toBe(0);
  });

  it("should cache responses for identical message sequences", async () => {
    const mw = createCachingMiddleware();
    let generateCallCount = 0;

    const model = createMockModel([]);
    model.generate = async (): Promise<ModelResponse> => {
      generateCallCount++;
      return {
        text: "Response " + generateCallCount,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    };

    const agent = createAgent({
      name: "cache-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    const r1 = await agent.run("Hello");
    expect(r1.text).toBe("Response 1");
    expect(mw.cacheSize).toBe(1);

    // Same input should still call the model (the cache will inject
    // the result in afterGenerate, but the model is still called)
    // Actually — the current implementation doesn't prevent the model call,
    // it just overwrites the response after. This is by design since
    // middleware runs around the generate call, not instead of it.
    // For the cache to truly prevent calls, a more invasive approach is needed.
    // However, the afterGenerate overwrite means the RESPONSE is cached.
    const r2 = await agent.run("Hello");
    expect(r2.text).toBe("Response 1"); // Should get cached response
  });

  it("should return different responses for different inputs", async () => {
    const mw = createCachingMiddleware();
    let generateCallCount = 0;

    const model = createMockModel([]);
    model.generate = async (): Promise<ModelResponse> => {
      generateCallCount++;
      return {
        text: "Response " + generateCallCount,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    };

    const agent = createAgent({
      name: "cache-diff-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    const r1 = await agent.run("Hello");
    const r2 = await agent.run("World");

    expect(r1.text).toBe("Response 1");
    expect(r2.text).toBe("Response 2");
    expect(mw.cacheSize).toBe(2);
  });

  it("should evict entries when exceeding maxSize", async () => {
    const mw = createCachingMiddleware({ maxSize: 2 });
    let generateCallCount = 0;

    const model = createMockModel([]);
    model.generate = async (): Promise<ModelResponse> => {
      generateCallCount++;
      return {
        text: "Response " + generateCallCount,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    };

    const agent = createAgent({
      name: "evict-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("A");
    await agent.run("B");
    await agent.run("C");

    // Should have evicted one entry to stay at maxSize
    expect(mw.cacheSize).toBeLessThanOrEqual(2);
  });

  it("should clear cache on clearCache()", async () => {
    const mw = createCachingMiddleware();
    let generateCallCount = 0;

    const model = createMockModel([]);
    model.generate = async (): Promise<ModelResponse> => {
      generateCallCount++;
      return {
        text: "Response " + generateCallCount,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    };

    const agent = createAgent({
      name: "clear-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hello");
    expect(mw.cacheSize).toBe(1);

    mw.clearCache();
    expect(mw.cacheSize).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cost-tracking middleware
// ---------------------------------------------------------------------------

describe("createCostTrackingMiddleware", () => {
  it("should start with zero counters", () => {
    const mw = createCostTrackingMiddleware();
    const snapshot = mw.getSnapshot();
    expect(snapshot.totalPromptTokens).toBe(0);
    expect(snapshot.totalCompletionTokens).toBe(0);
    expect(snapshot.totalTokens).toBe(0);
    expect(snapshot.callCount).toBe(0);
    expect(snapshot.estimatedCost).toBe(0);
  });

  it("should track token usage across calls", async () => {
    const mw = createCostTrackingMiddleware({
      promptTokenCost: 0.01,
      completionTokenCost: 0.03,
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "cost-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hi");

    const snapshot = mw.getSnapshot();
    expect(snapshot.totalPromptTokens).toBe(100);
    expect(snapshot.totalCompletionTokens).toBe(50);
    expect(snapshot.totalTokens).toBe(150);
    expect(snapshot.callCount).toBe(1);
    expect(snapshot.estimatedCost).toBeCloseTo(100 * 0.01 + 50 * 0.03);
  });

  it("should accumulate across multiple agent runs", async () => {
    const mw = createCostTrackingMiddleware();

    const model = createMockModel([
      {
        text: "R1",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      {
        text: "R2",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "multi-cost-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("First");
    await agent.run("Second");

    const snapshot = mw.getSnapshot();
    expect(snapshot.totalPromptTokens).toBe(30);
    expect(snapshot.totalCompletionTokens).toBe(15);
    expect(snapshot.callCount).toBe(2);
  });

  it("should track multi-step tool calls", async () => {
    const mw = createCostTrackingMiddleware();

    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "t", arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Done.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const tool: ToolDefinition = {
      name: "t",
      description: "test",
      parameters: { type: "object" },
      execute: async () => "ok",
    };

    const agent = createAgent({
      name: "tool-cost-agent",
      model,
      systemPrompt: "Test.",
      tools: [tool],
      middlewares: [mw],
    });

    await agent.run("Do it");

    const snapshot = mw.getSnapshot();
    expect(snapshot.callCount).toBe(2);
    expect(snapshot.totalPromptTokens).toBe(30);
    expect(snapshot.totalCompletionTokens).toBe(15);
  });

  it("should reset counters", async () => {
    const mw = createCostTrackingMiddleware();

    const model = createMockModel([
      {
        text: "R1",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "reset-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hello");
    expect(mw.getSnapshot().callCount).toBe(1);

    mw.reset();
    const snapshot = mw.getSnapshot();
    expect(snapshot.totalPromptTokens).toBe(0);
    expect(snapshot.totalCompletionTokens).toBe(0);
    expect(snapshot.callCount).toBe(0);
  });

  it("should calculate cost with zero pricing by default", async () => {
    const mw = createCostTrackingMiddleware();

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "zero-cost-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await agent.run("Hi");

    const snapshot = mw.getSnapshot();
    expect(snapshot.estimatedCost).toBe(0);
    expect(snapshot.totalTokens).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// Composing multiple built-in middlewares
// ---------------------------------------------------------------------------

describe("Composing built-in middlewares", () => {
  it("should work with logging and cost-tracking together", async () => {
    const logs: string[] = [];
    const logging = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });
    const cost = createCostTrackingMiddleware({
      promptTokenCost: 0.001,
      completionTokenCost: 0.002,
    });

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "composed-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [logging, cost],
    });

    await agent.run("Hi");

    expect(logs.length).toBeGreaterThan(0);
    expect(cost.getSnapshot().callCount).toBe(1);
    expect(cost.getSnapshot().estimatedCost).toBeCloseTo(0.1 + 0.1);
  });

  it("should work with all three middlewares", async () => {
    const logs: string[] = [];
    const logging = createLoggingMiddleware({
      logger: (msg) => logs.push(msg),
      timing: false,
    });
    const caching = createCachingMiddleware();
    const cost = createCostTrackingMiddleware();

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      {
        text: "Hello again!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "all-three-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [logging, caching, cost],
    });

    await agent.run("Hi");
    expect(caching.cacheSize).toBe(1);

    // Second run with same input — cache should apply
    await agent.run("Hi");

    expect(logs.length).toBeGreaterThan(0);
    // Cost tracking should show 2 calls
    expect(cost.getSnapshot().callCount).toBe(2);
  });
});
