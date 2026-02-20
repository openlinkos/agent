/**
 * Tests for sequential (pipeline) coordination mode.
 */

import { describe, it, expect, vi } from "vitest";
import { createTeam } from "../src/team.js";
import type { SequentialConfig, TeamHooks } from "../src/types.js";
import type { Agent, AgentResponse } from "@openlinkos/agent";
import type { Model } from "@openlinkos/ai";
import type { Message, ModelResponse, ToolDefinition as AIToolDef, StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;
  return {
    modelId: "mock:test",
    async generate(): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return { text: "fallback", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: "stop" };
      }
      return responses[callIndex++];
    },
    async stream(): Promise<StreamResult> { throw new Error("Not implemented"); },
    async generateWithTools(_m: Message[], _t: AIToolDef[]): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return { text: "fallback", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: "stop" };
      }
      return responses[callIndex++];
    },
  };
}

function mockAgent(name: string, text: string, usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      return { text, steps: [], toolCalls: [], usage, agentName: name };
    },
  };
}

function mockAgentFn(name: string, fn: (input: string) => string): Agent {
  return {
    name,
    async run(input: string): Promise<AgentResponse> {
      return { text: fn(input), steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: name };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sequential coordination mode", () => {
  it("should execute agents in order as a pipeline", async () => {
    const callOrder: string[] = [];
    const agentA: Agent = {
      name: "agent-a",
      async run(): Promise<AgentResponse> {
        callOrder.push("a");
        return { text: "Output A", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-a" };
      },
    };
    const agentB: Agent = {
      name: "agent-b",
      async run(): Promise<AgentResponse> {
        callOrder.push("b");
        return { text: "Output B", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-b" };
      },
    };
    const agentC: Agent = {
      name: "agent-c",
      async run(): Promise<AgentResponse> {
        callOrder.push("c");
        return { text: "Output C", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-c" };
      },
    };

    const team = createTeam({
      name: "seq-team",
      agents: [agentA, agentB, agentC],
      coordinationMode: "sequential",
    });

    const result = await team.run("Initial task");

    expect(callOrder).toEqual(["a", "b", "c"]);
    expect(result.finalOutput).toBe("Output C");
    expect(result.agentResults).toHaveLength(3);
    expect(result.rounds).toBe(1);
  });

  it("should pass previous agent output as context to the next agent", async () => {
    const inputs: string[] = [];

    const agentA = mockAgent("agent-a", "Research findings");
    const agentB: Agent = {
      name: "agent-b",
      async run(input: string): Promise<AgentResponse> {
        inputs.push(input);
        return { text: "Final article", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-b" };
      },
    };

    const team = createTeam({
      name: "context-team",
      agents: [agentA, agentB],
      coordinationMode: "sequential",
    });

    await team.run("Write an article");

    expect(inputs[0]).toContain("Research findings");
    expect(inputs[0]).toContain("Write an article");
  });

  it("should support early exit when agent signals [DONE]", async () => {
    const callOrder: string[] = [];

    const agentA: Agent = {
      name: "agent-a",
      async run(): Promise<AgentResponse> {
        callOrder.push("a");
        return { text: "Complete answer [DONE]", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-a" };
      },
    };
    const agentB: Agent = {
      name: "agent-b",
      async run(): Promise<AgentResponse> {
        callOrder.push("b");
        return { text: "Should not run", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "agent-b" };
      },
    };

    const team = createTeam({
      name: "early-exit-team",
      agents: [agentA, agentB],
      coordinationMode: "sequential",
    });

    const result = await team.run("Quick task");

    expect(callOrder).toEqual(["a"]);
    expect(result.agentResults).toHaveLength(1);
    expect(result.finalOutput).toContain("Complete answer");
  });

  it("should aggregate usage across all agents", async () => {
    const agentA = mockAgent("a", "A", { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    const agentB = mockAgent("b", "B", { promptTokens: 20, completionTokens: 10, totalTokens: 30 });

    const team = createTeam({
      name: "usage-team",
      agents: [agentA, agentB],
      coordinationMode: "sequential",
    });

    const result = await team.run("Test");

    expect(result.totalUsage.promptTokens).toBe(30);
    expect(result.totalUsage.completionTokens).toBe(15);
    expect(result.totalUsage.totalTokens).toBe(45);
  });

  it("should respect maxRounds to limit pipeline length", async () => {
    const agents = [
      mockAgent("a", "A"),
      mockAgent("b", "B"),
      mockAgent("c", "C"),
    ];

    const team = createTeam({
      name: "limited-team",
      agents,
      coordinationMode: "sequential",
      maxRounds: 2,
    });

    const result = await team.run("Test");

    // Only first 2 agents should run
    expect(result.agentResults).toHaveLength(2);
    expect(result.finalOutput).toBe("B");
  });

  it("should propagate agent errors", async () => {
    const failAgent: Agent = {
      name: "fail-agent",
      async run(): Promise<AgentResponse> {
        throw new Error("Agent crashed");
      },
    };

    const team = createTeam({
      name: "error-team",
      agents: [failAgent],
      coordinationMode: "sequential",
    });

    await expect(team.run("Test")).rejects.toThrow("Agent crashed");
  });

  it("should call hooks at appropriate times", async () => {
    const onRoundStart = vi.fn();
    const onAgentStart = vi.fn();
    const onAgentEnd = vi.fn();
    const onRoundEnd = vi.fn();

    const hooks: TeamHooks = { onRoundStart, onAgentStart, onAgentEnd, onRoundEnd };

    const team = createTeam({
      name: "hooks-team",
      agents: [mockAgent("a", "A"), mockAgent("b", "B")],
      coordinationMode: "sequential",
      hooks,
    });

    await team.run("Test");

    expect(onRoundStart).toHaveBeenCalledWith(1);
    expect(onAgentStart).toHaveBeenCalledTimes(2);
    expect(onAgentStart).toHaveBeenCalledWith("a", 1);
    expect(onAgentStart).toHaveBeenCalledWith("b", 2);
    expect(onAgentEnd).toHaveBeenCalledTimes(2);
    expect(onRoundEnd).toHaveBeenCalledWith(1, expect.any(Array));
  });

  it("should handle single agent", async () => {
    const team = createTeam({
      name: "solo-team",
      agents: [mockAgent("solo", "Solo output")],
      coordinationMode: "sequential",
    });

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Solo output");
    expect(result.agentResults).toHaveLength(1);
  });
});
