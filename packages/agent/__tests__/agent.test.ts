/**
 * Tests for the agent ReAct engine.
 */

import { describe, it, expect, vi } from "vitest";
import { createAgent } from "../src/index.js";
import type { AgentConfig, ToolDefinition, AgentHooks, AgentStep } from "../src/types.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { InputGuardrail, OutputGuardrail, ContentFilter } from "../src/guardrails.js";

// ---------------------------------------------------------------------------
// Mock model
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAgent", () => {
  it("should create an agent with the given name", () => {
    const model = createMockModel([]);
    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are helpful.",
    });
    expect(agent.name).toBe("test-agent");
  });
});

describe("Agent.run", () => {
  it("should return text response for simple generation (no tools)", async () => {
    const model = createMockModel([
      {
        text: "Hello! I can help you.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "simple-agent",
      model,
      systemPrompt: "You are helpful.",
    });

    const response = await agent.run("Hello");
    expect(response.text).toBe("Hello! I can help you.");
    expect(response.agentName).toBe("simple-agent");
    expect(response.steps).toHaveLength(1);
    expect(response.toolCalls).toHaveLength(0);
    expect(response.usage.totalTokens).toBe(30);
  });

  it("should execute tool calls in ReAct loop", async () => {
    const model = createMockModel([
      // Step 1: Model requests tool call
      {
        text: "Let me check the weather.",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: { city: "Tokyo" } },
        ],
        usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
        finishReason: "tool_calls",
      },
      // Step 2: Model returns final answer after tool result
      {
        text: "The weather in Tokyo is 72°F.",
        toolCalls: [],
        usage: { promptTokens: 40, completionTokens: 12, totalTokens: 52 },
        finishReason: "stop",
      },
    ]);

    const weatherTool: ToolDefinition = {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute: async (params) => ({ temp: 72, city: params.city }),
    };

    const agent = createAgent({
      name: "weather-agent",
      model,
      systemPrompt: "You help with weather.",
      tools: [weatherTool],
    });

    const response = await agent.run("What's the weather in Tokyo?");
    expect(response.text).toBe("The weather in Tokyo is 72°F.");
    expect(response.steps).toHaveLength(2);
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0].name).toBe("get_weather");
    expect(response.usage.totalTokens).toBe(87);
  });

  it("should handle tool execution errors gracefully", async () => {
    const model = createMockModel([
      {
        text: "Let me try the failing tool.",
        toolCalls: [
          { id: "call_1", name: "fail_tool", arguments: {} },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "The tool failed, but I'll continue.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const failTool: ToolDefinition = {
      name: "fail_tool",
      description: "A tool that fails",
      parameters: { type: "object" },
      execute: async () => {
        throw new Error("Tool execution failed!");
      },
    };

    const agent = createAgent({
      name: "error-agent",
      model,
      systemPrompt: "Test agent.",
      tools: [failTool],
    });

    const response = await agent.run("Try the tool");
    expect(response.text).toBe("The tool failed, but I'll continue.");
    expect(response.steps[0].toolCalls[0].error).toBe("Tool execution failed!");
  });

  it("should respect maxIterations", async () => {
    // Model always requests a tool call, never stopping
    const infiniteToolCalls = Array.from({ length: 10 }, () => ({
      text: "Calling tool again.",
      toolCalls: [{ id: `call_${Math.random()}`, name: "loop_tool", arguments: {} }],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "tool_calls" as const,
    }));

    const model = createMockModel(infiniteToolCalls);

    const loopTool: ToolDefinition = {
      name: "loop_tool",
      description: "A tool used in loops",
      parameters: { type: "object" },
      execute: async () => "loop result",
    };

    const agent = createAgent({
      name: "loop-agent",
      model,
      systemPrompt: "Test.",
      tools: [loopTool],
      maxIterations: 3,
    });

    await expect(agent.run("Loop")).rejects.toThrow(
      'Agent "loop-agent" reached maximum iterations (3)',
    );
  });

  it("should handle unknown tool gracefully", async () => {
    const model = createMockModel([
      {
        text: "Let me use a tool.",
        toolCalls: [
          { id: "call_1", name: "nonexistent_tool", arguments: {} },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Tool not found, returning.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "unknown-tool-agent",
      model,
      systemPrompt: "Test.",
      tools: [],
    });

    const response = await agent.run("Use a tool");
    expect(response.steps[0].toolCalls[0].error).toContain("not available");
  });

  it("should call lifecycle hooks", async () => {
    const model = createMockModel([
      {
        text: "Using a tool.",
        toolCalls: [
          { id: "call_1", name: "test_tool", arguments: { x: 1 } },
        ],
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

    const onStart = vi.fn();
    const onToolCall = vi.fn();
    const onToolResult = vi.fn();
    const onStep = vi.fn();
    const onEnd = vi.fn();

    const hooks: AgentHooks = { onStart, onToolCall, onToolResult, onStep, onEnd };

    const testTool: ToolDefinition = {
      name: "test_tool",
      description: "Test tool",
      parameters: { type: "object", properties: { x: { type: "number" } } },
      execute: async (params) => ({ result: params.x }),
    };

    const agent = createAgent({
      name: "hooks-agent",
      model,
      systemPrompt: "Test.",
      tools: [testTool],
      hooks,
    });

    await agent.run("Do something");

    expect(onStart).toHaveBeenCalledWith("Do something");
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolResult).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("should block tool call when onToolCall returns false", async () => {
    const model = createMockModel([
      {
        text: "Calling blocked tool.",
        toolCalls: [
          { id: "call_1", name: "blocked_tool", arguments: {} },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Tool was blocked.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const blockedTool: ToolDefinition = {
      name: "blocked_tool",
      description: "Should be blocked",
      parameters: { type: "object" },
      execute: vi.fn().mockResolvedValue("should not run"),
    };

    const agent = createAgent({
      name: "block-agent",
      model,
      systemPrompt: "Test.",
      tools: [blockedTool],
      hooks: {
        onToolCall: () => false,
      },
    });

    const response = await agent.run("Try blocked tool");
    expect(response.steps[0].toolCalls[0].error).toContain("Blocked");
    expect(blockedTool.execute).not.toHaveBeenCalled();
  });

  it("should call onError hook on model failure", async () => {
    const model = createMockModel([]);
    // Override generate to throw
    model.generate = async () => {
      throw new Error("Model crashed");
    };

    const onError = vi.fn();
    const agent = createAgent({
      name: "error-agent",
      model,
      systemPrompt: "Test.",
      hooks: { onError },
    });

    await expect(agent.run("trigger error")).rejects.toThrow("Model crashed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should aggregate usage across all steps", async () => {
    const model = createMockModel([
      {
        text: "Step 1.",
        toolCalls: [{ id: "c1", name: "t", arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Step 2.",
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
      name: "usage-agent",
      model,
      systemPrompt: "Test.",
      tools: [tool],
    });

    const response = await agent.run("test");
    expect(response.usage.promptTokens).toBe(30);
    expect(response.usage.completionTokens).toBe(15);
    expect(response.usage.totalTokens).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// Guardrails integration tests
// ---------------------------------------------------------------------------

describe("Agent guardrails integration", () => {
  it("should block input when input guardrail fails", async () => {
    const model = createMockModel([
      {
        text: "Should not reach here",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const guardrail: InputGuardrail = {
      name: "block-short",
      validate: (input) =>
        input.length < 5
          ? { passed: false, reason: "Input too short" }
          : { passed: true },
    };

    const agent = createAgent({
      name: "guarded-agent",
      model,
      systemPrompt: "Test.",
      inputGuardrails: [guardrail],
    });

    await expect(agent.run("Hi")).rejects.toThrow("Input too short");
  });

  it("should allow input when input guardrails pass", async () => {
    const model = createMockModel([
      {
        text: "All good!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const guardrail: InputGuardrail = {
      name: "allow-all",
      validate: () => ({ passed: true }),
    };

    const agent = createAgent({
      name: "guarded-agent",
      model,
      systemPrompt: "Test.",
      inputGuardrails: [guardrail],
    });

    const response = await agent.run("Hello there");
    expect(response.text).toBe("All good!");
  });

  it("should block output when output guardrail fails", async () => {
    const model = createMockModel([
      {
        text: "Here is your SSN: 123-45-6789",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const guardrail: OutputGuardrail = {
      name: "no-pii",
      validate: (output) =>
        output.includes("SSN")
          ? { passed: false, reason: "Contains PII" }
          : { passed: true },
    };

    const agent = createAgent({
      name: "guarded-agent",
      model,
      systemPrompt: "Test.",
      outputGuardrails: [guardrail],
    });

    await expect(agent.run("Tell me a secret")).rejects.toThrow("PII");
  });

  it("should allow output when output guardrails pass", async () => {
    const model = createMockModel([
      {
        text: "Clean output here.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const guardrail: OutputGuardrail = {
      name: "check-clean",
      validate: () => ({ passed: true }),
    };

    const agent = createAgent({
      name: "guarded-agent",
      model,
      systemPrompt: "Test.",
      outputGuardrails: [guardrail],
    });

    const response = await agent.run("Say something");
    expect(response.text).toBe("Clean output here.");
  });

  it("should apply content filters to output", async () => {
    const model = createMockModel([
      {
        text: "The password is secret123 and the key is abc",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const filter: ContentFilter = {
      name: "redact-secrets",
      filter: (content) => content.replace(/secret123/g, "[REDACTED]"),
    };

    const agent = createAgent({
      name: "filtered-agent",
      model,
      systemPrompt: "Test.",
      contentFilters: [filter],
    });

    const response = await agent.run("Show secrets");
    expect(response.text).toBe("The password is [REDACTED] and the key is abc");
  });

  it("should block output when content filter returns null", async () => {
    const model = createMockModel([
      {
        text: "Harmful content here",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const filter: ContentFilter = {
      name: "block-harmful",
      filter: (content) => (content.includes("Harmful") ? null : content),
    };

    const agent = createAgent({
      name: "filtered-agent",
      model,
      systemPrompt: "Test.",
      contentFilters: [filter],
    });

    await expect(agent.run("Generate something")).rejects.toThrow(
      "Content was blocked by content filter",
    );
  });

  it("should run multiple input guardrails in order", async () => {
    const model = createMockModel([
      {
        text: "All checks passed.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const callOrder: string[] = [];

    const guardrail1: InputGuardrail = {
      name: "check-1",
      validate: () => {
        callOrder.push("check-1");
        return { passed: true };
      },
    };

    const guardrail2: InputGuardrail = {
      name: "check-2",
      validate: () => {
        callOrder.push("check-2");
        return { passed: false, reason: "Blocked by check-2" };
      },
    };

    const agent = createAgent({
      name: "multi-guard-agent",
      model,
      systemPrompt: "Test.",
      inputGuardrails: [guardrail1, guardrail2],
    });

    await expect(agent.run("Test")).rejects.toThrow("check-2");
    expect(callOrder).toEqual(["check-1", "check-2"]);
  });

  it("should call onError hook when guardrail fails", async () => {
    const model = createMockModel([
      {
        text: "Should not reach here",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const onError = vi.fn();

    const guardrail: InputGuardrail = {
      name: "blocker",
      validate: () => ({ passed: false, reason: "Blocked" }),
    };

    const agent = createAgent({
      name: "error-hook-agent",
      model,
      systemPrompt: "Test.",
      inputGuardrails: [guardrail],
      hooks: { onError },
    });

    await expect(agent.run("Test")).rejects.toThrow("Blocked");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should run both output guardrails and content filters", async () => {
    const model = createMockModel([
      {
        text: "Hello WORLD with extras",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const outputGuardrail: OutputGuardrail = {
      name: "check-length",
      validate: (output) =>
        output.length > 0 ? { passed: true } : { passed: false, reason: "Empty" },
    };

    const contentFilter: ContentFilter = {
      name: "lowercase",
      filter: (content) => content.toLowerCase(),
    };

    const agent = createAgent({
      name: "full-guard-agent",
      model,
      systemPrompt: "Test.",
      outputGuardrails: [outputGuardrail],
      contentFilters: [contentFilter],
    });

    const response = await agent.run("Hello");
    expect(response.text).toBe("hello world with extras");
  });

  it("should work with guardrails and tools together", async () => {
    const model = createMockModel([
      {
        text: "Let me search.",
        toolCalls: [{ id: "c1", name: "search", arguments: { q: "test" } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Found result: badword detected",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const searchTool: ToolDefinition = {
      name: "search",
      description: "Search",
      parameters: { type: "object", properties: { q: { type: "string" } } },
      execute: async () => "search results",
    };

    const contentFilter: ContentFilter = {
      name: "redact-badword",
      filter: (content) => content.replace(/badword/g, "***"),
    };

    const agent = createAgent({
      name: "tools-guard-agent",
      model,
      systemPrompt: "Test.",
      tools: [searchTool],
      contentFilters: [contentFilter],
    });

    const response = await agent.run("Search for something");
    expect(response.text).toBe("Found result: *** detected");
    expect(response.toolCalls).toHaveLength(1);
  });
});
