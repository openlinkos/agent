/**
 * Tests for the sub-agent engine.
 */

import { describe, it, expect, vi } from "vitest";
import { spawnSubAgent, spawnParallel } from "../src/subagent.js";
import type { SubAgentConfig } from "../src/types.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef, StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Mock model factory
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;

  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses configured",
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
          text: "No more responses configured",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
  };
}

function makeSimpleConfig(name: string, text: string): SubAgentConfig {
  return {
    name,
    model: createMockModel([
      {
        text,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]),
    systemPrompt: "You are a test agent.",
  };
}

// ---------------------------------------------------------------------------
// spawnSubAgent tests
// ---------------------------------------------------------------------------

describe("spawnSubAgent", () => {
  it("should spawn and run a sub-agent successfully", async () => {
    const config = makeSimpleConfig("test-sub", "Sub-agent response");
    const result = await spawnSubAgent(config, "Hello");

    expect(result.success).toBe(true);
    expect(result.agentName).toBe("test-sub");
    expect(result.response.text).toBe("Sub-agent response");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.tokens.totalTokens).toBe(15);
    expect(result.steps).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it("should handle sub-agent failure gracefully", async () => {
    const model = createMockModel([]);
    model.generate = async () => {
      throw new Error("Model exploded");
    };

    const config: SubAgentConfig = {
      name: "fail-sub",
      model,
      systemPrompt: "Test.",
    };

    const result = await spawnSubAgent(config, "Trigger failure");

    expect(result.success).toBe(false);
    expect(result.agentName).toBe("fail-sub");
    expect(result.error).toBe("Model exploded");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should timeout sub-agent execution", async () => {
    const slowModel = createMockModel([]);
    slowModel.generate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return {
        text: "Too slow",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop" as const,
      };
    };

    const config: SubAgentConfig = {
      name: "slow-sub",
      model: slowModel,
      systemPrompt: "Test.",
    };

    const result = await spawnSubAgent(config, "Be slow", { timeout: 50 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });

  it("should cancel via AbortSignal", async () => {
    const controller = new AbortController();

    const slowModel = createMockModel([]);
    slowModel.generate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return {
        text: "Should not reach",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop" as const,
      };
    };

    const config: SubAgentConfig = {
      name: "cancel-sub",
      model: slowModel,
      systemPrompt: "Test.",
    };

    // Cancel after 50ms
    setTimeout(() => controller.abort(), 50);

    const result = await spawnSubAgent(config, "Cancel me", {
      signal: controller.signal,
      timeout: 10_000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("cancelled");
  });

  it("should handle already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const config = makeSimpleConfig("aborted-sub", "Should not run");

    const result = await spawnSubAgent(config, "Already cancelled", {
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cancelled before execution");
  });

  it("should enforce max nesting depth", async () => {
    const config = makeSimpleConfig("deep-sub", "Deep response");

    const result = await spawnSubAgent(
      config,
      "Go deep",
      { maxDepth: 2 },
      undefined,
      2, // already at depth 2
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Maximum nesting depth");
  });

  it("should report progress events", async () => {
    const config = makeSimpleConfig("progress-sub", "Done");
    const progressUpdates: Array<{ type: string; agentName: string }> = [];

    await spawnSubAgent(config, "Report progress", {}, (update) => {
      progressUpdates.push({ type: update.type, agentName: update.agentName });
    });

    expect(progressUpdates).toEqual([
      { type: "started", agentName: "progress-sub" },
      { type: "completed", agentName: "progress-sub" },
    ]);
  });

  it("should report failure progress events", async () => {
    const model = createMockModel([]);
    model.generate = async () => {
      throw new Error("Failed");
    };

    const config: SubAgentConfig = {
      name: "fail-progress-sub",
      model,
      systemPrompt: "Test.",
    };

    const progressUpdates: string[] = [];

    await spawnSubAgent(config, "Fail", {}, (update) => {
      progressUpdates.push(update.type);
    });

    expect(progressUpdates).toEqual(["started", "failed"]);
  });

  it("should include tool calls in result metadata", async () => {
    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "search", arguments: { q: "test" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Tool used successfully.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const config: SubAgentConfig = {
      name: "tool-sub",
      model,
      systemPrompt: "Test.",
      tools: [
        {
          name: "search",
          description: "Search tool",
          parameters: { type: "object", properties: { q: { type: "string" } } },
          execute: async () => "search results",
        },
      ],
    };

    const result = await spawnSubAgent(config, "Search for something");

    expect(result.success).toBe(true);
    expect(result.steps).toBe(2);
    expect(result.tokens.totalTokens).toBe(45);
    expect(result.response.toolCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// spawnParallel tests
// ---------------------------------------------------------------------------

describe("spawnParallel", () => {
  it("should run multiple sub-agents in parallel", async () => {
    const configs = [
      makeSimpleConfig("agent-1", "Response 1"),
      makeSimpleConfig("agent-2", "Response 2"),
      makeSimpleConfig("agent-3", "Response 3"),
    ];

    const results = await spawnParallel(
      configs,
      ["Input 1", "Input 2", "Input 3"],
    );

    expect(results).toHaveLength(3);
    expect(results[0].agentName).toBe("agent-1");
    expect(results[0].response.text).toBe("Response 1");
    expect(results[1].agentName).toBe("agent-2");
    expect(results[1].response.text).toBe("Response 2");
    expect(results[2].agentName).toBe("agent-3");
    expect(results[2].response.text).toBe("Response 3");
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("should handle empty arrays", async () => {
    const results = await spawnParallel([], []);
    expect(results).toEqual([]);
  });

  it("should throw when configs and inputs have different lengths", async () => {
    await expect(
      spawnParallel(
        [makeSimpleConfig("a", "A")],
        ["input 1", "input 2"],
      ),
    ).rejects.toThrow("same length");
  });

  it("should handle mixed success and failure results", async () => {
    const failModel = createMockModel([]);
    failModel.generate = async () => {
      throw new Error("Failed");
    };

    const configs: SubAgentConfig[] = [
      makeSimpleConfig("success-agent", "Success!"),
      { name: "fail-agent", model: failModel, systemPrompt: "Test." },
      makeSimpleConfig("success-agent-2", "Also success!"),
    ];

    const results = await spawnParallel(
      configs,
      ["Go", "Fail", "Also go"],
    );

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe("Failed");
    expect(results[2].success).toBe(true);
  });

  it("should respect maxConcurrent batching", async () => {
    const callTimes: number[] = [];

    const makeDelayedConfig = (name: string, text: string): SubAgentConfig => {
      const model = createMockModel([]);
      model.generate = async () => {
        callTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 50));
        return {
          text,
          toolCalls: [],
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
          finishReason: "stop" as const,
        };
      };
      return { name, model, systemPrompt: "Test." };
    };

    const configs = [
      makeDelayedConfig("a", "A"),
      makeDelayedConfig("b", "B"),
      makeDelayedConfig("c", "C"),
      makeDelayedConfig("d", "D"),
    ];

    const results = await spawnParallel(
      configs,
      ["1", "2", "3", "4"],
      { maxConcurrent: 2 },
    );

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.success)).toBe(true);

    // With maxConcurrent=2 and 4 agents, there should be 2 batches.
    // The third call should start after the first batch finishes.
    if (callTimes.length === 4) {
      const gap = callTimes[2] - callTimes[0];
      expect(gap).toBeGreaterThanOrEqual(40); // second batch started after first
    }
  });

  it("should report progress for all sub-agents", async () => {
    const configs = [
      makeSimpleConfig("p1", "R1"),
      makeSimpleConfig("p2", "R2"),
    ];

    const progressUpdates: string[] = [];

    await spawnParallel(
      configs,
      ["I1", "I2"],
      {},
      (update) => {
        progressUpdates.push(`${update.agentName}:${update.type}`);
      },
    );

    expect(progressUpdates).toContain("p1:started");
    expect(progressUpdates).toContain("p1:completed");
    expect(progressUpdates).toContain("p2:started");
    expect(progressUpdates).toContain("p2:completed");
  });
});
