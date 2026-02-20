/**
 * Tests for agent presets.
 */

import { describe, it, expect } from "vitest";
import { presets } from "../src/presets.js";
import { createAgent } from "../src/index.js";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { ToolDefinition } from "../src/types.js";

// ---------------------------------------------------------------------------
// Mock model
// ---------------------------------------------------------------------------

function createMockModel(): Model {
  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      return {
        text: "Mock response",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Stream not implemented in mock");
    },
    async generateWithTools(
      _messages: Message[],
      _tools: AIToolDef[],
    ): Promise<ModelResponse> {
      return {
        text: "Mock response",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Chatbot preset
// ---------------------------------------------------------------------------

describe("presets.chatbot", () => {
  it("should create a chatbot config with default name", () => {
    const model = createMockModel();
    const config = presets.chatbot(model);
    expect(config.name).toBe("chatbot");
    expect(config.model).toBe(model);
  });

  it("should include a conversational system prompt", () => {
    const model = createMockModel();
    const config = presets.chatbot(model);
    expect(config.systemPrompt).toContain("friendly");
    expect(config.systemPrompt).toContain("conversational");
  });

  it("should allow overriding name", () => {
    const model = createMockModel();
    const config = presets.chatbot(model, { name: "my-chatbot" });
    expect(config.name).toBe("my-chatbot");
  });

  it("should allow overriding systemPrompt", () => {
    const model = createMockModel();
    const config = presets.chatbot(model, { systemPrompt: "Custom prompt" });
    expect(config.systemPrompt).toBe("Custom prompt");
  });

  it("should be usable with createAgent", async () => {
    const model = createMockModel();
    const config = presets.chatbot(model);
    const agent = createAgent(config);
    expect(agent.name).toBe("chatbot");
    const response = await agent.run("Hello");
    expect(response.text).toBe("Mock response");
  });
});

// ---------------------------------------------------------------------------
// Researcher preset
// ---------------------------------------------------------------------------

describe("presets.researcher", () => {
  it("should create a researcher config with default name", () => {
    const model = createMockModel();
    const config = presets.researcher(model);
    expect(config.name).toBe("researcher");
    expect(config.model).toBe(model);
  });

  it("should include an analytical system prompt", () => {
    const model = createMockModel();
    const config = presets.researcher(model);
    expect(config.systemPrompt).toContain("research");
    expect(config.systemPrompt).toContain("evidence");
  });

  it("should accept optional tools", () => {
    const model = createMockModel();
    const tools: ToolDefinition[] = [
      {
        name: "search",
        description: "Web search",
        parameters: { type: "object", properties: { query: { type: "string" } } },
        execute: async () => "results",
      },
    ];
    const config = presets.researcher(model, tools);
    expect(config.tools).toHaveLength(1);
    expect(config.tools![0].name).toBe("search");
  });

  it("should default to empty tools array when none provided", () => {
    const model = createMockModel();
    const config = presets.researcher(model);
    expect(config.tools).toEqual([]);
  });

  it("should set higher maxIterations for research tasks", () => {
    const model = createMockModel();
    const config = presets.researcher(model);
    expect(config.maxIterations).toBe(15);
  });

  it("should allow overrides", () => {
    const model = createMockModel();
    const config = presets.researcher(model, undefined, {
      name: "custom-researcher",
      maxIterations: 20,
    });
    expect(config.name).toBe("custom-researcher");
    expect(config.maxIterations).toBe(20);
  });

  it("should be usable with createAgent", async () => {
    const model = createMockModel();
    const config = presets.researcher(model);
    const agent = createAgent(config);
    expect(agent.name).toBe("researcher");
    const response = await agent.run("Research topic X");
    expect(response.text).toBe("Mock response");
  });
});

// ---------------------------------------------------------------------------
// Coder preset
// ---------------------------------------------------------------------------

describe("presets.coder", () => {
  it("should create a coder config with default name", () => {
    const model = createMockModel();
    const config = presets.coder(model);
    expect(config.name).toBe("coder");
    expect(config.model).toBe(model);
  });

  it("should include a code-focused system prompt", () => {
    const model = createMockModel();
    const config = presets.coder(model);
    expect(config.systemPrompt).toContain("software engineer");
    expect(config.systemPrompt).toContain("code");
  });

  it("should allow overriding any field", () => {
    const model = createMockModel();
    const tools: ToolDefinition[] = [
      {
        name: "exec",
        description: "Execute code",
        parameters: { type: "object" },
        execute: async () => "output",
      },
    ];
    const config = presets.coder(model, {
      name: "my-coder",
      tools,
      maxIterations: 5,
    });
    expect(config.name).toBe("my-coder");
    expect(config.tools).toHaveLength(1);
    expect(config.maxIterations).toBe(5);
  });

  it("should be usable with createAgent", async () => {
    const model = createMockModel();
    const config = presets.coder(model);
    const agent = createAgent(config);
    expect(agent.name).toBe("coder");
    const response = await agent.run("Write a function");
    expect(response.text).toBe("Mock response");
  });
});

// ---------------------------------------------------------------------------
// Analyst preset
// ---------------------------------------------------------------------------

describe("presets.analyst", () => {
  it("should create an analyst config with default name", () => {
    const model = createMockModel();
    const config = presets.analyst(model);
    expect(config.name).toBe("analyst");
    expect(config.model).toBe(model);
  });

  it("should include a data analysis system prompt", () => {
    const model = createMockModel();
    const config = presets.analyst(model);
    expect(config.systemPrompt).toContain("data analysis");
    expect(config.systemPrompt).toContain("insights");
  });

  it("should allow overriding any field", () => {
    const model = createMockModel();
    const config = presets.analyst(model, {
      name: "custom-analyst",
      systemPrompt: "Analyze this data.",
    });
    expect(config.name).toBe("custom-analyst");
    expect(config.systemPrompt).toBe("Analyze this data.");
  });

  it("should be usable with createAgent", async () => {
    const model = createMockModel();
    const config = presets.analyst(model);
    const agent = createAgent(config);
    expect(agent.name).toBe("analyst");
    const response = await agent.run("Analyze the data");
    expect(response.text).toBe("Mock response");
  });
});

// ---------------------------------------------------------------------------
// General preset behavior
// ---------------------------------------------------------------------------

describe("preset customization", () => {
  it("should preserve model reference across all presets", () => {
    const model = createMockModel();
    expect(presets.chatbot(model).model).toBe(model);
    expect(presets.researcher(model).model).toBe(model);
    expect(presets.coder(model).model).toBe(model);
    expect(presets.analyst(model).model).toBe(model);
  });

  it("should not mutate the returned config when overrides are applied", () => {
    const model = createMockModel();
    const base = presets.chatbot(model);
    const overridden = presets.chatbot(model, { name: "custom" });
    expect(base.name).toBe("chatbot");
    expect(overridden.name).toBe("custom");
  });

  it("should return a fresh object on each call", () => {
    const model = createMockModel();
    const c1 = presets.chatbot(model);
    const c2 = presets.chatbot(model);
    expect(c1).not.toBe(c2);
    expect(c1).toEqual(c2);
  });
});
