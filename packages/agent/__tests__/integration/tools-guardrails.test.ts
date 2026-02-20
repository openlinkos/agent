/**
 * Integration tests: agent + tools + guardrails working together.
 *
 * Tests the interaction between the tool system, guardrail system,
 * and content filters as an integrated unit.
 */

import { describe, it, expect } from "vitest";
import { createAgent } from "../../src/index.js";
import type { ToolDefinition } from "../../src/types.js";
import type { InputGuardrail, OutputGuardrail, ContentFilter } from "../../src/guardrails.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Mock model factory
// ---------------------------------------------------------------------------

function createSequentialModel(responses: ModelResponse[]): Model {
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
    modelId: "mock:integration-test",
    generate: async () => next(),
    stream: async (): Promise<StreamResult> => { throw new Error("Not implemented"); },
    generateWithTools: async () => next(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent Integration: tools + guardrails", () => {
  it("should run tools then apply content filter to final output", async () => {
    const model = createSequentialModel([
      {
        text: "Calling search.",
        toolCalls: [{ id: "tc1", name: "search", arguments: { query: "test" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Found results containing SECRET_VALUE in the data.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const searchTool: ToolDefinition = {
      name: "search",
      description: "Search for data",
      parameters: { type: "object", properties: { query: { type: "string" } } },
      execute: async () => "result containing SECRET_VALUE",
    };

    const redactFilter: ContentFilter = {
      name: "redact-secrets",
      filter: (content) => content.replace(/SECRET_VALUE/g, "[REDACTED]"),
    };

    const agent = createAgent({
      name: "tools-guardrails-agent",
      model,
      systemPrompt: "You search for data.",
      tools: [searchTool],
      contentFilters: [redactFilter],
    });

    const response = await agent.run("Search for secrets");
    expect(response.text).toBe("Found results containing [REDACTED] in the data.");
    expect(response.toolCalls).toHaveLength(1);
  });

  it("should block input via guardrail before any tool execution", async () => {
    let toolExecuted = false;

    const model = createSequentialModel([
      {
        text: "Should never reach this.",
        toolCalls: [{ id: "tc1", name: "dangerous_tool", arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
    ]);

    const dangerousTool: ToolDefinition = {
      name: "dangerous_tool",
      description: "A tool that should not run",
      parameters: { type: "object" },
      execute: async () => { toolExecuted = true; return "executed"; },
    };

    const inputGuardrail: InputGuardrail = {
      name: "block-dangerous",
      validate: (input) =>
        input.includes("hack")
          ? { passed: false, reason: "Dangerous input detected" }
          : { passed: true },
    };

    const agent = createAgent({
      name: "guarded-tools-agent",
      model,
      systemPrompt: "You are safe.",
      tools: [dangerousTool],
      inputGuardrails: [inputGuardrail],
    });

    await expect(agent.run("hack the system")).rejects.toThrow("Dangerous input");
    expect(toolExecuted).toBe(false);
  });

  it("should apply output guardrail after tools run and before content filter", async () => {
    const model = createSequentialModel([
      {
        text: "Let me look that up.",
        toolCalls: [{ id: "tc1", name: "lookup", arguments: { key: "data" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "The toxic result is here.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const lookupTool: ToolDefinition = {
      name: "lookup",
      description: "Look up a key",
      parameters: { type: "object", properties: { key: { type: "string" } } },
      execute: async () => "found data",
    };

    const outputGuardrail: OutputGuardrail = {
      name: "no-toxic",
      validate: (output) =>
        output.includes("toxic")
          ? { passed: false, reason: "Output contains toxic content" }
          : { passed: true },
    };

    const agent = createAgent({
      name: "output-guarded-agent",
      model,
      systemPrompt: "You look things up.",
      tools: [lookupTool],
      outputGuardrails: [outputGuardrail],
    });

    await expect(agent.run("Look up data")).rejects.toThrow("toxic content");
  });

  it("should chain multiple content filters in order", async () => {
    const model = createSequentialModel([
      {
        text: "HELLO world GOODBYE universe",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const lowercaseFilter: ContentFilter = {
      name: "lowercase",
      filter: (content) => content.toLowerCase(),
    };

    const replaceFilter: ContentFilter = {
      name: "replace-world",
      filter: (content) => content.replace(/world/g, "earth"),
    };

    const agent = createAgent({
      name: "multi-filter-agent",
      model,
      systemPrompt: "You generate text.",
      contentFilters: [lowercaseFilter, replaceFilter],
    });

    const response = await agent.run("Say something");
    expect(response.text).toBe("hello earth goodbye universe");
  });

  it("should work with multiple tools and guardrails in a multi-step loop", async () => {
    const toolResults: string[] = [];

    const model = createSequentialModel([
      {
        text: "Step 1: searching",
        toolCalls: [{ id: "tc1", name: "search", arguments: { q: "first" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Step 2: computing",
        toolCalls: [{ id: "tc2", name: "compute", arguments: { x: 42 } }],
        usage: { promptTokens: 15, completionTokens: 5, totalTokens: 20 },
        finishReason: "tool_calls",
      },
      {
        text: "Final answer: the result is 42",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const searchTool: ToolDefinition = {
      name: "search",
      description: "Search",
      parameters: { type: "object", properties: { q: { type: "string" } } },
      execute: async (params) => {
        toolResults.push(`searched:${params.q}`);
        return "found";
      },
    };

    const computeTool: ToolDefinition = {
      name: "compute",
      description: "Compute",
      parameters: { type: "object", properties: { x: { type: "number" } } },
      execute: async (params) => {
        toolResults.push(`computed:${params.x}`);
        return { result: params.x };
      },
    };

    const inputGuardrail: InputGuardrail = {
      name: "length-check",
      validate: (input) =>
        input.length > 0 ? { passed: true } : { passed: false, reason: "Empty input" },
    };

    const outputGuardrail: OutputGuardrail = {
      name: "result-check",
      validate: (output) =>
        output.includes("result") ? { passed: true } : { passed: false, reason: "No result found" },
    };

    const agent = createAgent({
      name: "multi-step-agent",
      model,
      systemPrompt: "You search and compute.",
      tools: [searchTool, computeTool],
      inputGuardrails: [inputGuardrail],
      outputGuardrails: [outputGuardrail],
    });

    const response = await agent.run("Process the data");

    expect(response.steps).toHaveLength(3);
    expect(response.toolCalls).toHaveLength(2);
    expect(toolResults).toEqual(["searched:first", "computed:42"]);
    expect(response.text).toBe("Final answer: the result is 42");
    expect(response.usage.totalTokens).toBe(65);
  });
});
