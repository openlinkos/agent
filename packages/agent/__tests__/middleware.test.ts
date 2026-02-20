/**
 * Tests for the middleware system.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MiddlewareStack,
} from "../src/middleware.js";
import type {
  Middleware,
  BeforeGenerateContext,
  AfterGenerateContext,
  BeforeToolCallContext,
  AfterToolCallContext,
  ErrorContext,
} from "../src/middleware.js";

// ---------------------------------------------------------------------------
// MiddlewareStack basics
// ---------------------------------------------------------------------------

describe("MiddlewareStack", () => {
  it("should start empty", () => {
    const stack = new MiddlewareStack();
    expect(stack.size).toBe(0);
    expect(stack.all()).toEqual([]);
  });

  it("should add middleware via use()", () => {
    const stack = new MiddlewareStack();
    const mw: Middleware = { name: "test" };
    stack.use(mw);
    expect(stack.size).toBe(1);
    expect(stack.all()).toHaveLength(1);
    expect(stack.all()[0].name).toBe("test");
  });

  it("should return a snapshot from all() (not the internal array)", () => {
    const stack = new MiddlewareStack();
    stack.use({ name: "a" });
    const snapshot = stack.all();
    stack.use({ name: "b" });
    expect(snapshot).toHaveLength(1);
    expect(stack.all()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Onion-model execution order
// ---------------------------------------------------------------------------

describe("MiddlewareStack onion execution", () => {
  it("should execute beforeGenerate in onion order", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use({
      name: "outer",
      async beforeGenerate(_ctx, next) {
        order.push("outer-before");
        await next();
        order.push("outer-after");
      },
    });

    stack.use({
      name: "inner",
      async beforeGenerate(_ctx, next) {
        order.push("inner-before");
        await next();
        order.push("inner-after");
      },
    });

    const ctx: BeforeGenerateContext = {
      messages: [],
      tools: [],
      iteration: 0,
    };
    await stack.executeBeforeGenerate(ctx);

    expect(order).toEqual([
      "outer-before",
      "inner-before",
      "inner-after",
      "outer-after",
    ]);
  });

  it("should execute afterGenerate in onion order", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use({
      name: "outer",
      async afterGenerate(_ctx, next) {
        order.push("outer-before");
        await next();
        order.push("outer-after");
      },
    });

    stack.use({
      name: "inner",
      async afterGenerate(_ctx, next) {
        order.push("inner-before");
        await next();
        order.push("inner-after");
      },
    });

    const ctx: AfterGenerateContext = {
      response: {
        text: "test",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      },
      messages: [],
      iteration: 0,
    };
    await stack.executeAfterGenerate(ctx);

    expect(order).toEqual([
      "outer-before",
      "inner-before",
      "inner-after",
      "outer-after",
    ]);
  });

  it("should execute beforeToolCall in onion order", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use({
      name: "outer",
      async beforeToolCall(_ctx, next) {
        order.push("outer");
        await next();
      },
    });
    stack.use({
      name: "inner",
      async beforeToolCall(_ctx, next) {
        order.push("inner");
        await next();
      },
    });

    await stack.executeBeforeToolCall({
      toolCall: { id: "1", name: "t", arguments: {} },
      skip: false,
    });

    expect(order).toEqual(["outer", "inner"]);
  });

  it("should execute afterToolCall in onion order", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use({
      name: "outer",
      async afterToolCall(_ctx, next) {
        order.push("outer");
        await next();
      },
    });
    stack.use({
      name: "inner",
      async afterToolCall(_ctx, next) {
        order.push("inner");
        await next();
      },
    });

    await stack.executeAfterToolCall({
      toolCall: { id: "1", name: "t", arguments: {} },
      result: "ok",
    });

    expect(order).toEqual(["outer", "inner"]);
  });

  it("should execute onError in onion order", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    stack.use({
      name: "outer",
      async onError(_ctx, next) {
        order.push("outer");
        await next();
      },
    });
    stack.use({
      name: "inner",
      async onError(_ctx, next) {
        order.push("inner");
        await next();
      },
    });

    await stack.executeOnError({
      error: new Error("test"),
      handled: false,
    });

    expect(order).toEqual(["outer", "inner"]);
  });
});

// ---------------------------------------------------------------------------
// Short-circuiting
// ---------------------------------------------------------------------------

describe("MiddlewareStack short-circuit", () => {
  it("should short-circuit when next() is not called", async () => {
    const stack = new MiddlewareStack();
    const innerFn = vi.fn();

    stack.use({
      name: "blocker",
      async beforeGenerate(_ctx, _next) {
        // Intentionally not calling next()
      },
    });

    stack.use({
      name: "inner",
      async beforeGenerate(_ctx, next) {
        innerFn();
        await next();
      },
    });

    await stack.executeBeforeGenerate({
      messages: [],
      tools: [],
      iteration: 0,
    });

    expect(innerFn).not.toHaveBeenCalled();
  });

  it("should allow middleware to modify context before passing through", async () => {
    const stack = new MiddlewareStack();

    stack.use({
      name: "modifier",
      async beforeGenerate(ctx, next) {
        ctx.messages.push({ role: "system", content: "injected" });
        await next();
      },
    });

    const ctx: BeforeGenerateContext = {
      messages: [{ role: "user", content: "hello" }],
      tools: [],
      iteration: 0,
    };
    await stack.executeBeforeGenerate(ctx);

    expect(ctx.messages).toHaveLength(2);
    expect(ctx.messages[1].content).toBe("injected");
  });

  it("should allow beforeToolCall middleware to skip tool execution", async () => {
    const stack = new MiddlewareStack();

    stack.use({
      name: "skipper",
      async beforeToolCall(ctx, next) {
        ctx.skip = true;
        ctx.result = "cached-result";
        await next();
      },
    });

    const ctx: BeforeToolCallContext = {
      toolCall: { id: "1", name: "test", arguments: {} },
      skip: false,
    };
    await stack.executeBeforeToolCall(ctx);

    expect(ctx.skip).toBe(true);
    expect(ctx.result).toBe("cached-result");
  });
});

// ---------------------------------------------------------------------------
// Middleware with no handlers for a hook
// ---------------------------------------------------------------------------

describe("MiddlewareStack skips middleware without handler", () => {
  it("should skip middleware that has no handler for the hook", async () => {
    const stack = new MiddlewareStack();
    const order: string[] = [];

    // Only has beforeGenerate
    stack.use({
      name: "gen-only",
      async beforeGenerate(_ctx, next) {
        order.push("gen-only");
        await next();
      },
    });

    // Only has afterGenerate
    stack.use({
      name: "after-only",
      async afterGenerate(_ctx, next) {
        order.push("after-only");
        await next();
      },
    });

    // Has beforeGenerate
    stack.use({
      name: "both",
      async beforeGenerate(_ctx, next) {
        order.push("both");
        await next();
      },
    });

    await stack.executeBeforeGenerate({
      messages: [],
      tools: [],
      iteration: 0,
    });

    // "after-only" should be skipped for beforeGenerate
    expect(order).toEqual(["gen-only", "both"]);
  });

  it("should work with empty stack", async () => {
    const stack = new MiddlewareStack();
    // Should not throw
    await stack.executeBeforeGenerate({
      messages: [],
      tools: [],
      iteration: 0,
    });
    await stack.executeAfterGenerate({
      response: {
        text: "test",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      },
      messages: [],
      iteration: 0,
    });
    await stack.executeBeforeToolCall({
      toolCall: { id: "1", name: "t", arguments: {} },
      skip: false,
    });
    await stack.executeAfterToolCall({
      toolCall: { id: "1", name: "t", arguments: {} },
      result: "ok",
    });
    await stack.executeOnError({
      error: new Error("test"),
      handled: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Context mutation across middleware chain
// ---------------------------------------------------------------------------

describe("MiddlewareStack context mutation", () => {
  it("should allow afterGenerate middleware to modify the response", async () => {
    const stack = new MiddlewareStack();

    stack.use({
      name: "response-modifier",
      async afterGenerate(ctx, next) {
        await next();
        ctx.response.text = "modified";
      },
    });

    const ctx: AfterGenerateContext = {
      response: {
        text: "original",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      },
      messages: [],
      iteration: 0,
    };
    await stack.executeAfterGenerate(ctx);

    expect(ctx.response.text).toBe("modified");
  });

  it("should allow onError middleware to mark error as handled", async () => {
    const stack = new MiddlewareStack();

    stack.use({
      name: "error-handler",
      async onError(ctx, next) {
        ctx.handled = true;
        await next();
      },
    });

    const ctx: ErrorContext = {
      error: new Error("test"),
      handled: false,
    };
    await stack.executeOnError(ctx);

    expect(ctx.handled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: middleware with agent
// ---------------------------------------------------------------------------

import { createAgent } from "../src/index.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { ToolDefinition } from "../src/types.js";

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

describe("Agent with middleware", () => {
  it("should invoke beforeGenerate and afterGenerate middleware", async () => {
    const beforeFn = vi.fn();
    const afterFn = vi.fn();

    const mw: Middleware = {
      name: "test-mw",
      async beforeGenerate(ctx, next) {
        beforeFn(ctx.iteration);
        await next();
      },
      async afterGenerate(ctx, next) {
        afterFn(ctx.response.text);
        await next();
      },
    };

    const model = createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "mw-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    const response = await agent.run("Hi");
    expect(response.text).toBe("Hello!");
    expect(beforeFn).toHaveBeenCalledWith(0);
    expect(afterFn).toHaveBeenCalledWith("Hello!");
  });

  it("should invoke beforeToolCall and afterToolCall middleware", async () => {
    const beforeToolFn = vi.fn();
    const afterToolFn = vi.fn();

    const mw: Middleware = {
      name: "tool-mw",
      async beforeToolCall(ctx, next) {
        beforeToolFn(ctx.toolCall.name);
        await next();
      },
      async afterToolCall(ctx, next) {
        afterToolFn(ctx.result);
        await next();
      },
    };

    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "greet", arguments: { name: "world" } }],
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

    const greetTool: ToolDefinition = {
      name: "greet",
      description: "Greet someone",
      parameters: { type: "object", properties: { name: { type: "string" } } },
      execute: async (params) => `Hello ${params.name}`,
    };

    const agent = createAgent({
      name: "tool-mw-agent",
      model,
      systemPrompt: "Test.",
      tools: [greetTool],
      middlewares: [mw],
    });

    await agent.run("Greet world");
    expect(beforeToolFn).toHaveBeenCalledWith("greet");
    expect(afterToolFn).toHaveBeenCalledWith("Hello world");
  });

  it("should allow middleware to skip tool execution", async () => {
    const toolExecute = vi.fn().mockResolvedValue("real result");

    const mw: Middleware = {
      name: "skip-mw",
      async beforeToolCall(ctx, next) {
        ctx.skip = true;
        ctx.result = "mocked result";
        await next();
      },
    };

    const model = createMockModel([
      {
        text: "Using tool.",
        toolCalls: [{ id: "c1", name: "expensive", arguments: {} }],
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
      name: "expensive",
      description: "Expensive operation",
      parameters: { type: "object" },
      execute: toolExecute,
    };

    const agent = createAgent({
      name: "skip-agent",
      model,
      systemPrompt: "Test.",
      tools: [tool],
      middlewares: [mw],
    });

    const response = await agent.run("Do it");
    expect(toolExecute).not.toHaveBeenCalled();
    expect(response.steps[0].toolCalls[0].result).toBe("mocked result");
  });

  it("should invoke onError middleware on failure", async () => {
    const errorFn = vi.fn();

    const mw: Middleware = {
      name: "error-mw",
      async onError(ctx, next) {
        errorFn(ctx.error.message);
        await next();
      },
    };

    const model = createMockModel([]);
    model.generate = async () => {
      throw new Error("Model failed");
    };

    const agent = createAgent({
      name: "error-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    await expect(agent.run("fail")).rejects.toThrow("Model failed");
    expect(errorFn).toHaveBeenCalledWith("Model failed");
  });

  it("should allow afterGenerate middleware to modify response text", async () => {
    const mw: Middleware = {
      name: "modifier",
      async afterGenerate(ctx, next) {
        await next();
        ctx.response.text = (ctx.response.text ?? "") + " [modified]";
      },
    };

    const model = createMockModel([
      {
        text: "Original",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "mod-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw],
    });

    const response = await agent.run("Hello");
    expect(response.text).toBe("Original [modified]");
  });

  it("should run multiple middleware in correct onion order", async () => {
    const order: string[] = [];

    const mw1: Middleware = {
      name: "mw1",
      async beforeGenerate(_ctx, next) {
        order.push("mw1-enter");
        await next();
        order.push("mw1-exit");
      },
    };

    const mw2: Middleware = {
      name: "mw2",
      async beforeGenerate(_ctx, next) {
        order.push("mw2-enter");
        await next();
        order.push("mw2-exit");
      },
    };

    const model = createMockModel([
      {
        text: "Hi",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "order-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [mw1, mw2],
    });

    await agent.run("Hello");
    expect(order).toEqual(["mw1-enter", "mw2-enter", "mw2-exit", "mw1-exit"]);
  });
});
