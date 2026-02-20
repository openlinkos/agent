/**
 * Tests for agent-as-tool.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { agentAsTool, getCurrentDepth, resetDepth } from "../src/agent-tool.js";
import type { Agent, AgentResponse } from "../src/types.js";
import type { Usage } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAgent(name: string, responseText?: string): Agent {
  return {
    name,
    async run(input: string): Promise<AgentResponse> {
      return {
        text: responseText ?? `${name} says: ${input}`,
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } as Usage,
        agentName: name,
      };
    },
    async use(): Promise<void> {
      // no-op
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("agentAsTool", () => {
  beforeEach(() => {
    resetDepth();
  });

  it("should create a valid ToolDefinition from an agent", () => {
    const agent = createMockAgent("helper");
    const tool = agentAsTool(agent);

    expect(tool.name).toBe("agent_helper");
    expect(tool.description).toContain("helper");
    expect(tool.parameters.type).toBe("object");
    expect(tool.parameters.required).toContain("query");
    expect(typeof tool.execute).toBe("function");
  });

  it("should use custom description when provided", () => {
    const agent = createMockAgent("helper");
    const tool = agentAsTool(agent, {
      description: "A custom helper agent",
    });

    expect(tool.description).toBe("A custom helper agent");
  });

  it("should execute the agent and return its text response", async () => {
    const agent = createMockAgent("echo");
    const tool = agentAsTool(agent);

    const result = await tool.execute({ query: "hello world" });
    expect(result).toBe("echo says: hello world");
  });

  it("should track and reset depth correctly", async () => {
    expect(getCurrentDepth()).toBe(0);

    const agent = createMockAgent("test");
    const tool = agentAsTool(agent);

    await tool.execute({ query: "test" });
    // Depth should be back to 0 after execution
    expect(getCurrentDepth()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Nested agents
  // ---------------------------------------------------------------------------

  it("should support nested agent calls", async () => {
    const innerAgent = createMockAgent("inner", "inner-result");
    const innerTool = agentAsTool(innerAgent);

    // Create an outer agent that calls the inner tool
    const outerAgent: Agent = {
      name: "outer",
      async run(input: string): Promise<AgentResponse> {
        // Simulate the outer agent calling the inner tool
        const toolResult = await innerTool.execute({ query: input });
        return {
          text: `outer(${toolResult})`,
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "outer",
        };
      },
      async use(): Promise<void> {
        // no-op
      },
    };

    const outerTool = agentAsTool(outerAgent);
    const result = await outerTool.execute({ query: "test" });
    expect(result).toBe("outer(inner-result)");
    expect(getCurrentDepth()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Depth limit
  // ---------------------------------------------------------------------------

  it("should throw when maximum depth is exceeded", async () => {
    // Create an agent that recursively calls itself via tool
    let recursiveTool: ReturnType<typeof agentAsTool>;

    const recursiveAgent: Agent = {
      name: "recursive",
      async run(input: string): Promise<AgentResponse> {
        const result = await recursiveTool.execute({ query: input });
        return {
          text: String(result),
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "recursive",
        };
      },
      async use(): Promise<void> {
        // no-op
      },
    };

    recursiveTool = agentAsTool(recursiveAgent, { maxDepth: 2 });

    await expect(recursiveTool.execute({ query: "go" })).rejects.toThrow(
      "maximum depth exceeded",
    );
  });

  it("should respect custom maxDepth", async () => {
    let callCount = 0;

    // Chain of agents: each calls the next
    const deepAgent: Agent = {
      name: "deep",
      async run(): Promise<AgentResponse> {
        callCount++;
        return {
          text: `depth-${callCount}`,
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          agentName: "deep",
        };
      },
      async use(): Promise<void> {
        // no-op
      },
    };

    // maxDepth=1 means only 1 level of nesting allowed
    const tool = agentAsTool(deepAgent, { maxDepth: 1 });
    const result = await tool.execute({ query: "go" });
    expect(result).toBe("depth-1");
    expect(callCount).toBe(1);
  });

  it("should restore depth on error", async () => {
    const errorAgent: Agent = {
      name: "error-agent",
      async run(): Promise<AgentResponse> {
        throw new Error("Agent failed");
      },
      async use(): Promise<void> {
        // no-op
      },
    };

    const tool = agentAsTool(errorAgent);

    await expect(tool.execute({ query: "test" })).rejects.toThrow("Agent failed");
    // Depth should be restored even on error
    expect(getCurrentDepth()).toBe(0);
  });
});
