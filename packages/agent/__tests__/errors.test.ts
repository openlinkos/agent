/**
 * Tests for agent-specific error types and abort support.
 */

import { describe, it, expect, vi } from "vitest";
import { MaxIterationsError } from "../src/errors.js";
import { createAgentEngine } from "../src/agent.js";
import { GuardrailError, AbortError, BaseError } from "@openlinkos/ai";
import type { Model, Message, ModelResponse, ToolCall, ToolDefinition as AIToolDef, FinishReason } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { InputGuardrail, OutputGuardrail } from "../src/guardrails.js";

// ---------------------------------------------------------------------------
// Mock model
// ---------------------------------------------------------------------------

function createMockModel(
  responses: Array<{
    text: string | null;
    toolCalls?: ToolCall[];
    finishReason?: string;
  }>,
): Model {
  let callIndex = 0;
  return {
    modelId: "test:mock",
    async generate(
      _msgs: Message[],
      _config?: unknown,
      options?: { signal?: AbortSignal },
    ): Promise<ModelResponse> {
      const r = responses[callIndex++] ?? responses[responses.length - 1];
      return {
        text: r.text,
        toolCalls: r.toolCalls ?? [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: (r.finishReason ?? "stop") as FinishReason,
      };
    },
    async stream(): Promise<StreamResult> {
      throw new Error("not implemented");
    },
    async generateWithTools(
      _msgs: Message[],
      _tools: AIToolDef[],
      _config?: unknown,
      options?: { signal?: AbortSignal },
    ): Promise<ModelResponse> {
      const r = responses[callIndex++] ?? responses[responses.length - 1];
      return {
        text: r.text,
        toolCalls: r.toolCalls ?? [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: (r.finishReason ?? "stop") as FinishReason,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// MaxIterationsError
// ---------------------------------------------------------------------------

describe("MaxIterationsError", () => {
  it("should have correct code MAX_ITERATIONS", () => {
    const err = new MaxIterationsError("hit the limit");
    expect(err.code).toBe("MAX_ITERATIONS");
  });

  it("should extend BaseError and Error", () => {
    const err = new MaxIterationsError("exceeded iterations");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("should carry the provided message", () => {
    const err = new MaxIterationsError("Agent reached 5 iterations");
    expect(err.message).toBe("Agent reached 5 iterations");
  });

  it("should preserve cause when provided", () => {
    const cause = new Error("underlying issue");
    const err = new MaxIterationsError("hit the limit", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// GuardrailError from agent
// ---------------------------------------------------------------------------

describe("Agent throws GuardrailError when input guardrail fails", () => {
  it("should throw GuardrailError with guardrailName 'input'", async () => {
    const model = createMockModel([
      { text: "Should never reach here", finishReason: "stop" },
    ]);

    const failingGuardrail: InputGuardrail = {
      name: "block-all",
      validate: () => ({ passed: false, reason: "Blocked by input guardrail" }),
    };

    const agent = createAgentEngine({
      name: "guarded-agent",
      model,
      systemPrompt: "You are helpful.",
      inputGuardrails: [failingGuardrail],
    });

    try {
      await agent.run("Hello");
      expect.fail("Expected GuardrailError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GuardrailError);
      const ge = err as GuardrailError;
      expect(ge.code).toBe("GUARDRAIL_ERROR");
      expect(ge.guardrailName).toBe("input");
      expect(ge.message).toContain("Blocked by input guardrail");
    }
  });
});

describe("Agent throws GuardrailError when output guardrail fails", () => {
  it("should throw GuardrailError with guardrailName 'output'", async () => {
    const model = createMockModel([
      { text: "Some model output that should be blocked", finishReason: "stop" },
    ]);

    const passingInputGuardrail: InputGuardrail = {
      name: "allow-all",
      validate: () => ({ passed: true }),
    };

    const failingOutputGuardrail: OutputGuardrail = {
      name: "block-output",
      validate: () => ({ passed: false, reason: "Output is not allowed" }),
    };

    const agent = createAgentEngine({
      name: "output-guarded-agent",
      model,
      systemPrompt: "You are helpful.",
      inputGuardrails: [passingInputGuardrail],
      outputGuardrails: [failingOutputGuardrail],
    });

    try {
      await agent.run("Hello there, long enough input");
      expect.fail("Expected GuardrailError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GuardrailError);
      const ge = err as GuardrailError;
      expect(ge.code).toBe("GUARDRAIL_ERROR");
      expect(ge.guardrailName).toBe("output");
      expect(ge.message).toContain("Output is not allowed");
    }
  });
});

// ---------------------------------------------------------------------------
// AbortSignal support
// ---------------------------------------------------------------------------

describe("Agent respects AbortSignal", () => {
  it("should reject when signal is already aborted before run", async () => {
    const model = createMockModel([
      { text: "Should never reach here", finishReason: "stop" },
    ]);

    const agent = createAgentEngine({
      name: "abort-agent",
      model,
      systemPrompt: "You are helpful.",
    });

    const controller = new AbortController();
    controller.abort();

    try {
      await agent.run("Hello", { signal: controller.signal });
      expect.fail("Expected AbortError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AbortError);
      expect((err as AbortError).code).toBe("ABORT_ERROR");
    }
  });

  it("should reject when signal is aborted during run", async () => {
    const controller = new AbortController();

    // Model that aborts mid-run via a tool call cycle
    const model = createMockModel([
      {
        text: "Let me call a tool.",
        toolCalls: [{ id: "c1", name: "slow_tool", arguments: {} }],
        finishReason: "tool_calls",
      },
      // The second call should not happen because abort fires first
      { text: "Done.", finishReason: "stop" },
    ]);

    const slowTool = {
      name: "slow_tool",
      description: "A slow tool",
      parameters: { type: "object" as const },
      execute: async () => {
        // Abort while the tool is "running"
        controller.abort();
        return "result";
      },
    };

    const agent = createAgentEngine({
      name: "abort-mid-agent",
      model,
      systemPrompt: "You are helpful.",
      tools: [slowTool],
      maxIterations: 5,
    });

    try {
      await agent.run("Do something slow", { signal: controller.signal });
      expect.fail("Expected AbortError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AbortError);
      expect((err as AbortError).code).toBe("ABORT_ERROR");
    }
  });
});

// ---------------------------------------------------------------------------
// Signal threading to model
// ---------------------------------------------------------------------------

describe("Agent threads signal to model", () => {
  it("should pass signal to model.generate in options", async () => {
    const controller = new AbortController();
    const generateSpy = vi.fn().mockResolvedValue({
      text: "Response",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    });

    const model: Model = {
      modelId: "test:spy-model",
      async generate(msgs, config, options) {
        return generateSpy(msgs, config, options);
      },
      async stream() {
        throw new Error("not implemented");
      },
      async generateWithTools(msgs, tools, config, options) {
        return generateSpy(msgs, config, options);
      },
    };

    const agent = createAgentEngine({
      name: "signal-thread-agent",
      model,
      systemPrompt: "You are helpful.",
    });

    await agent.run("Hello", { signal: controller.signal });

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const callArgs = generateSpy.mock.calls[0];
    // The options argument (third positional) should contain the signal
    const options = callArgs[2];
    expect(options).toBeDefined();
    expect(options.signal).toBe(controller.signal);
  });

  it("should pass signal to model.generateWithTools when tools are present", async () => {
    const controller = new AbortController();
    const generateWithToolsSpy = vi.fn().mockResolvedValue({
      text: "Response with tools",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    });

    const model: Model = {
      modelId: "test:spy-model-tools",
      async generate() {
        throw new Error("should not be called");
      },
      async stream() {
        throw new Error("not implemented");
      },
      async generateWithTools(msgs, tools, config, options) {
        return generateWithToolsSpy(msgs, tools, config, options);
      },
    };

    const dummyTool = {
      name: "dummy",
      description: "A dummy tool",
      parameters: { type: "object" as const },
      execute: async () => "ok",
    };

    const agent = createAgentEngine({
      name: "signal-tools-agent",
      model,
      systemPrompt: "You are helpful.",
      tools: [dummyTool],
    });

    await agent.run("Hello", { signal: controller.signal });

    expect(generateWithToolsSpy).toHaveBeenCalledTimes(1);
    const callArgs = generateWithToolsSpy.mock.calls[0];
    // generateWithTools receives (messages, tools, config, options)
    // The options argument is the fourth positional
    const options = callArgs[3];
    expect(options).toBeDefined();
    expect(options.signal).toBe(controller.signal);
  });
});
