/**
 * Tests for the plugin system.
 */

import { describe, it, expect, vi } from "vitest";
import { createAgent } from "../src/index.js";
import type { Plugin } from "../src/plugin.js";
import type { Middleware } from "../src/middleware.js";
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
// Plugin interface
// ---------------------------------------------------------------------------

describe("Plugin interface", () => {
  it("should install a plugin with middleware via config", async () => {
    const beforeFn = vi.fn();

    const mw: Middleware = {
      name: "plugin-mw",
      async beforeGenerate(_ctx, next) {
        beforeFn();
        await next();
      },
    };

    const plugin: Plugin = {
      name: "test-plugin",
      version: "1.0.0",
      middlewares: [mw],
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
      name: "plugin-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    await agent.run("Hi");
    expect(beforeFn).toHaveBeenCalled();
  });

  it("should install a plugin with tools via config", async () => {
    const tool: ToolDefinition = {
      name: "plugin_tool",
      description: "A plugin-provided tool",
      parameters: { type: "object", properties: { x: { type: "number" } } },
      execute: async (params) => ({ doubled: (params.x as number) * 2 }),
    };

    const plugin: Plugin = {
      name: "tool-plugin",
      version: "1.0.0",
      tools: [tool],
    };

    const model = createMockModel([
      {
        text: "Using plugin tool.",
        toolCalls: [{ id: "c1", name: "plugin_tool", arguments: { x: 5 } }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Result is 10.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "tool-plugin-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    const response = await agent.run("Double 5");
    expect(response.text).toBe("Result is 10.");
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0].name).toBe("plugin_tool");
  });

  it("should install a plugin with both middleware and tools", async () => {
    const afterFn = vi.fn();

    const mw: Middleware = {
      name: "combo-mw",
      async afterGenerate(_ctx, next) {
        afterFn();
        await next();
      },
    };

    const tool: ToolDefinition = {
      name: "combo_tool",
      description: "A combo tool",
      parameters: { type: "object" },
      execute: async () => "combo result",
    };

    const plugin: Plugin = {
      name: "combo-plugin",
      version: "2.0.0",
      middlewares: [mw],
      tools: [tool],
    };

    const model = createMockModel([
      {
        text: "Using combo tool.",
        toolCalls: [{ id: "c1", name: "combo_tool", arguments: {} }],
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

    const agent = createAgent({
      name: "combo-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    const response = await agent.run("Use combo");
    expect(response.text).toBe("Done.");
    expect(afterFn).toHaveBeenCalled();
    expect(response.toolCalls[0].name).toBe("combo_tool");
  });

  it("should call onInstall when plugin is installed via config (deferred to first run)", async () => {
    const onInstall = vi.fn();

    const plugin: Plugin = {
      name: "install-hook-plugin",
      version: "1.0.0",
      onInstall,
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
      name: "install-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    // onInstall is deferred until first run
    await agent.run("Hi");
    expect(onInstall).toHaveBeenCalledTimes(1);

    // Should not call again on subsequent runs
    await agent.run("Hi again");
    expect(onInstall).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// agent.use() for runtime plugin installation
// ---------------------------------------------------------------------------

describe("agent.use(plugin)", () => {
  it("should install a plugin via agent.use()", async () => {
    const beforeFn = vi.fn();

    const mw: Middleware = {
      name: "runtime-mw",
      async beforeGenerate(_ctx, next) {
        beforeFn();
        await next();
      },
    };

    const plugin: Plugin = {
      name: "runtime-plugin",
      version: "1.0.0",
      middlewares: [mw],
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
      name: "runtime-agent",
      model,
      systemPrompt: "Test.",
    });

    await agent.use(plugin);
    await agent.run("Hi");
    expect(beforeFn).toHaveBeenCalled();
  });

  it("should call onInstall immediately when using agent.use()", async () => {
    const onInstall = vi.fn();

    const plugin: Plugin = {
      name: "immediate-install",
      version: "1.0.0",
      onInstall,
    };

    const model = createMockModel([]);

    const agent = createAgent({
      name: "immediate-agent",
      model,
      systemPrompt: "Test.",
    });

    await agent.use(plugin);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("should throw if plugin with same name is installed twice", async () => {
    const plugin: Plugin = {
      name: "dup-plugin",
      version: "1.0.0",
    };

    const model = createMockModel([]);
    const agent = createAgent({
      name: "dup-agent",
      model,
      systemPrompt: "Test.",
    });

    await agent.use(plugin);
    await expect(agent.use(plugin)).rejects.toThrow(
      'Plugin "dup-plugin" is already installed.',
    );
  });

  it("should register plugin tools that are usable in agent runs", async () => {
    const tool: ToolDefinition = {
      name: "dynamic_tool",
      description: "Dynamically added tool",
      parameters: { type: "object" },
      execute: async () => "dynamic result",
    };

    const plugin: Plugin = {
      name: "dynamic-tool-plugin",
      version: "1.0.0",
      tools: [tool],
    };

    const model = createMockModel([
      {
        text: "Using dynamic tool.",
        toolCalls: [{ id: "c1", name: "dynamic_tool", arguments: {} }],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Got dynamic result.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "dynamic-agent",
      model,
      systemPrompt: "Test.",
    });

    await agent.use(plugin);
    const response = await agent.run("Use dynamic tool");
    expect(response.text).toBe("Got dynamic result.");
    expect(response.toolCalls[0].name).toBe("dynamic_tool");
  });
});

// ---------------------------------------------------------------------------
// Plugin combined with standalone middleware
// ---------------------------------------------------------------------------

describe("Plugin with standalone middleware", () => {
  it("should run both plugin middleware and standalone middleware", async () => {
    const order: string[] = [];

    const standaloneMw: Middleware = {
      name: "standalone",
      async beforeGenerate(_ctx, next) {
        order.push("standalone");
        await next();
      },
    };

    const pluginMw: Middleware = {
      name: "plugin-mw",
      async beforeGenerate(_ctx, next) {
        order.push("plugin");
        await next();
      },
    };

    const plugin: Plugin = {
      name: "order-plugin",
      version: "1.0.0",
      middlewares: [pluginMw],
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
      name: "order-agent",
      model,
      systemPrompt: "Test.",
      middlewares: [standaloneMw],
      plugins: [plugin],
    });

    await agent.run("Hi");

    // Standalone middleware is added first, then plugin middleware
    expect(order).toEqual(["standalone", "plugin"]);
  });

  it("should combine plugin tools with config tools", async () => {
    const configTool: ToolDefinition = {
      name: "config_tool",
      description: "Config tool",
      parameters: { type: "object" },
      execute: async () => "config result",
    };

    const pluginTool: ToolDefinition = {
      name: "plugin_tool",
      description: "Plugin tool",
      parameters: { type: "object" },
      execute: async () => "plugin result",
    };

    const plugin: Plugin = {
      name: "tool-combo-plugin",
      version: "1.0.0",
      tools: [pluginTool],
    };

    const model = createMockModel([
      {
        text: "Using both tools.",
        toolCalls: [
          { id: "c1", name: "config_tool", arguments: {} },
          { id: "c2", name: "plugin_tool", arguments: {} },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls",
      },
      {
        text: "Both tools worked.",
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "combo-tools-agent",
      model,
      systemPrompt: "Test.",
      tools: [configTool],
      plugins: [plugin],
    });

    const response = await agent.run("Use both");
    expect(response.toolCalls).toHaveLength(2);
    expect(response.steps[0].toolCalls[0].result).toBe("config result");
    expect(response.steps[0].toolCalls[1].result).toBe("plugin result");
  });
});

// ---------------------------------------------------------------------------
// Multiple plugins
// ---------------------------------------------------------------------------

describe("Multiple plugins", () => {
  it("should install multiple plugins via config", async () => {
    const order: string[] = [];

    const plugin1: Plugin = {
      name: "plugin-1",
      version: "1.0.0",
      middlewares: [{
        name: "mw1",
        async beforeGenerate(_ctx, next) {
          order.push("plugin-1");
          await next();
        },
      }],
    };

    const plugin2: Plugin = {
      name: "plugin-2",
      version: "1.0.0",
      middlewares: [{
        name: "mw2",
        async beforeGenerate(_ctx, next) {
          order.push("plugin-2");
          await next();
        },
      }],
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
      name: "multi-plugin-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin1, plugin2],
    });

    await agent.run("Hi");
    expect(order).toEqual(["plugin-1", "plugin-2"]);
  });

  it("should install multiple plugins via agent.use()", async () => {
    const order: string[] = [];

    const plugin1: Plugin = {
      name: "use-1",
      version: "1.0.0",
      middlewares: [{
        name: "mw1",
        async beforeGenerate(_ctx, next) {
          order.push("use-1");
          await next();
        },
      }],
    };

    const plugin2: Plugin = {
      name: "use-2",
      version: "1.0.0",
      middlewares: [{
        name: "mw2",
        async beforeGenerate(_ctx, next) {
          order.push("use-2");
          await next();
        },
      }],
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
      name: "multi-use-agent",
      model,
      systemPrompt: "Test.",
    });

    await agent.use(plugin1);
    await agent.use(plugin2);
    await agent.run("Hi");
    expect(order).toEqual(["use-1", "use-2"]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("Plugin edge cases", () => {
  it("should work with plugin that has no middleware or tools", async () => {
    const onInstall = vi.fn();

    const plugin: Plugin = {
      name: "empty-plugin",
      version: "0.0.1",
      onInstall,
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
      name: "empty-plugin-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    const response = await agent.run("Hi");
    expect(response.text).toBe("Hello!");
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("should handle async onInstall", async () => {
    let installed = false;

    const plugin: Plugin = {
      name: "async-install",
      version: "1.0.0",
      onInstall: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        installed = true;
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
      name: "async-agent",
      model,
      systemPrompt: "Test.",
      plugins: [plugin],
    });

    await agent.run("Hi");
    expect(installed).toBe(true);
  });

  it("should preserve agent behavior without any plugins or middleware", async () => {
    const model = createMockModel([
      {
        text: "Plain response.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
    ]);

    const agent = createAgent({
      name: "plain-agent",
      model,
      systemPrompt: "Test.",
    });

    const response = await agent.run("Hello");
    expect(response.text).toBe("Plain response.");
    expect(response.agentName).toBe("plain-agent");
  });
});
