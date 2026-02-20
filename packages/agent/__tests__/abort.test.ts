/**
 * Tests for AbortSignal support in the agent ReAct loop.
 */

import { describe, it, expect, vi } from "vitest";
import { createAgent } from "../src/index.js";
import type { ToolDefinition } from "../src/types.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import { AbortError } from "@openlinkos/ai";

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
          text: "Default response",
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },

    async stream(): Promise<StreamResult> {
      throw new Error("stream not implemented in mock");
    },

    async generateWithTools(
      _messages: Message[],
      _tools: AIToolDef[],
    ): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "Default response",
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
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

describe("Agent abort support", () => {
  it("should throw AbortError when signal is already aborted before run", async () => {
    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are a test agent.",
    });

    const controller = new AbortController();
    controller.abort();

    await expect(agent.run("Hello", { signal: controller.signal })).rejects.toThrow(AbortError);
  });

  it("should include descriptive message in AbortError", async () => {
    const model = createMockModel([]);

    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are a test agent.",
    });

    const controller = new AbortController();
    controller.abort();

    await expect(agent.run("Hello", { signal: controller.signal })).rejects.toThrow(
      "Agent run was aborted before starting",
    );
  });

  it("should succeed when signal is provided but not aborted", async () => {
    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are a test agent.",
    });

    const controller = new AbortController();
    const response = await agent.run("Hello", { signal: controller.signal });
    expect(response.text).toBe("Hello!");
  });

  it("should succeed without run options", async () => {
    const model = createMockModel([
      {
        text: "No options",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are a test agent.",
    });

    const response = await agent.run("Hello");
    expect(response.text).toBe("No options");
  });

  it("should call onError hook when aborted", async () => {
    const model = createMockModel([]);
    const onError = vi.fn();

    const agent = createAgent({
      name: "test-agent",
      model,
      systemPrompt: "You are a test agent.",
      hooks: { onError },
    });

    const controller = new AbortController();
    controller.abort();

    await expect(agent.run("Hello", { signal: controller.signal })).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(AbortError));
  });
});
