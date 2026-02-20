/**
 * Integration tests: agent + subagent delegation.
 *
 * Tests spawning sub-agents with real agent instances (mock model only).
 */

import { describe, it, expect } from "vitest";
import { createAgent } from "../../src/index.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import { spawnSubAgent, spawnParallel } from "../../../subagent/src/subagent.js";
import type { SubAgentConfig } from "../../../subagent/src/types.js";

// ---------------------------------------------------------------------------
// Mock model helpers
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let idx = 0;
  const next = (): ModelResponse => {
    if (idx >= responses.length) {
      return {
        text: "No more responses",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      };
    }
    return responses[idx++];
  };

  return {
    modelId: "mock:subagent-test",
    generate: async () => next(),
    stream: async (): Promise<StreamResult> => { throw new Error("Not implemented"); },
    generateWithTools: async () => next(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent Integration: subagent delegation", () => {
  it("should spawn a sub-agent and get its result", async () => {
    const model = createMockModel([
      {
        text: "Sub-agent response: I analyzed the data.",
        toolCalls: [],
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
        finishReason: "stop",
      },
    ]);

    const config: SubAgentConfig = {
      name: "analyzer-subagent",
      model,
      systemPrompt: "You analyze data.",
    };

    const result = await spawnSubAgent(config, "Analyze this data set");

    expect(result.success).toBe(true);
    expect(result.agentName).toBe("analyzer-subagent");
    expect(result.response.text).toBe("Sub-agent response: I analyzed the data.");
    expect(result.tokens.totalTokens).toBe(25);
    expect(result.steps).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should run multiple sub-agents in parallel", async () => {
    const model1 = createMockModel([{
      text: "Research result A",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    }]);

    const model2 = createMockModel([{
      text: "Research result B",
      toolCalls: [],
      usage: { promptTokens: 12, completionTokens: 6, totalTokens: 18 },
      finishReason: "stop",
    }]);

    const configs: SubAgentConfig[] = [
      { name: "researcher-a", model: model1, systemPrompt: "Research topic A." },
      { name: "researcher-b", model: model2, systemPrompt: "Research topic B." },
    ];

    const results = await spawnParallel(
      configs,
      ["Research A", "Research B"],
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].response.text).toBe("Research result A");
    expect(results[1].success).toBe(true);
    expect(results[1].response.text).toBe("Research result B");
  });

  it("should handle sub-agent timeout", async () => {
    const slowModel = createMockModel([]);
    // Override generate to be extremely slow
    slowModel.generate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return {
        text: "Should not reach",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      };
    };

    const config: SubAgentConfig = {
      name: "slow-subagent",
      model: slowModel,
      systemPrompt: "You are slow.",
      timeoutMs: 100,
    };

    const result = await spawnSubAgent(config, "Do something slow", { timeout: 100 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });

  it("should respect max nesting depth", async () => {
    const model = createMockModel([{
      text: "Nested response",
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop",
    }]);

    const config: SubAgentConfig = {
      name: "deep-subagent",
      model,
      systemPrompt: "You are nested.",
    };

    // Spawn at depth 5, max depth 3 — should fail
    const result = await spawnSubAgent(config, "test", { maxDepth: 3 }, undefined, 5);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Maximum nesting depth");
  });

  it("should collect progress updates from sub-agent execution", async () => {
    const model = createMockModel([{
      text: "Done.",
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop",
    }]);

    const config: SubAgentConfig = {
      name: "progress-subagent",
      model,
      systemPrompt: "You report progress.",
    };

    const updates: Array<{ type: string; agentName: string }> = [];
    const result = await spawnSubAgent(config, "Do work", {}, (update) => {
      updates.push({ type: update.type, agentName: update.agentName });
    });

    expect(result.success).toBe(true);
    expect(updates.some((u) => u.type === "started")).toBe(true);
    expect(updates.some((u) => u.type === "completed")).toBe(true);
    expect(updates.every((u) => u.agentName === "progress-subagent")).toBe(true);
  });
});
