/**
 * Tests for parallel coordination mode.
 */

import { describe, it, expect, vi } from "vitest";
import { createTeam } from "../src/team.js";
import { aggregate } from "../src/modes/parallel.js";
import type { ParallelConfig, TeamHooks } from "../src/types.js";
import type { Agent, AgentResponse } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockAgent(name: string, text: string, usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      return { text, steps: [], toolCalls: [], usage, agentName: name };
    },
  };
}

function mockSlowAgent(name: string, text: string, delayMs: number): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      await new Promise((r) => setTimeout(r, delayMs));
      return { text, steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: name };
    },
  };
}

function mockFailingAgent(name: string, errorMsg: string): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      throw new Error(errorMsg);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Parallel coordination mode", () => {
  it("should execute all agents on the same input", async () => {
    const receivedInputs: string[] = [];

    const agentA: Agent = {
      name: "a",
      async run(input: string): Promise<AgentResponse> {
        receivedInputs.push(input);
        return { text: "A", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "a" };
      },
    };
    const agentB: Agent = {
      name: "b",
      async run(input: string): Promise<AgentResponse> {
        receivedInputs.push(input);
        return { text: "B", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "b" };
      },
    };

    const team = createTeam({
      name: "par-team",
      agents: [agentA, agentB],
      coordinationMode: "parallel",
    } as ParallelConfig);

    await team.run("Same task");

    expect(receivedInputs).toEqual(["Same task", "Same task"]);
  });

  it("should merge-all by default", async () => {
    const team = createTeam({
      name: "merge-team",
      agents: [mockAgent("a", "Result A"), mockAgent("b", "Result B")],
      coordinationMode: "parallel",
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.finalOutput).toContain("[a]: Result A");
    expect(result.finalOutput).toContain("[b]: Result B");
  });

  it("should support first-wins strategy", async () => {
    const team = createTeam({
      name: "first-wins-team",
      agents: [mockAgent("a", "Winner"), mockAgent("b", "Loser")],
      coordinationMode: "parallel",
      aggregationStrategy: "first-wins",
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.finalOutput).toBe("Winner");
  });

  it("should support majority-vote strategy", async () => {
    const team = createTeam({
      name: "vote-team",
      agents: [
        mockAgent("a", "Yes"),
        mockAgent("b", "Yes"),
        mockAgent("c", "No"),
      ],
      coordinationMode: "parallel",
      aggregationStrategy: "majority-vote",
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.finalOutput).toBe("Yes");
  });

  it("should support custom reducer strategy", async () => {
    const team = createTeam({
      name: "custom-team",
      agents: [mockAgent("a", "Hello"), mockAgent("b", "World")],
      coordinationMode: "parallel",
      aggregationStrategy: "custom",
      customReducer: (responses) =>
        responses.map((r) => r.text).join(" + "),
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.finalOutput).toBe("Hello + World");
  });

  it("should throw when custom strategy has no reducer", async () => {
    const team = createTeam({
      name: "bad-custom-team",
      agents: [mockAgent("a", "A")],
      coordinationMode: "parallel",
      aggregationStrategy: "custom",
    } as ParallelConfig);

    await expect(team.run("Task")).rejects.toThrow("customReducer");
  });

  it("should handle agent timeout with graceful degradation", async () => {
    const team = createTeam({
      name: "timeout-team",
      agents: [
        mockAgent("fast", "Quick response"),
        mockSlowAgent("slow", "Slow response", 5000),
      ],
      coordinationMode: "parallel",
      agentTimeout: 50,
    } as ParallelConfig);

    const result = await team.run("Task");

    // Fast agent should complete, slow should timeout
    expect(result.agentResults.length).toBeGreaterThanOrEqual(1);
    expect(result.agentResults.some((r) => r.agentName === "fast")).toBe(true);
  });

  it("should handle agent failure gracefully", async () => {
    const onError = vi.fn();

    const team = createTeam({
      name: "fail-team",
      agents: [
        mockAgent("good", "Good result"),
        mockFailingAgent("bad", "Agent failed"),
      ],
      coordinationMode: "parallel",
      hooks: { onError },
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.agentResults).toHaveLength(1);
    expect(result.agentResults[0].agentName).toBe("good");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should aggregate usage across all agents", async () => {
    const team = createTeam({
      name: "usage-team",
      agents: [
        mockAgent("a", "A", { promptTokens: 10, completionTokens: 5, totalTokens: 15 }),
        mockAgent("b", "B", { promptTokens: 20, completionTokens: 10, totalTokens: 30 }),
      ],
      coordinationMode: "parallel",
    } as ParallelConfig);

    const result = await team.run("Task");

    expect(result.totalUsage.promptTokens).toBe(30);
    expect(result.totalUsage.completionTokens).toBe(15);
    expect(result.totalUsage.totalTokens).toBe(45);
  });

  it("should call hooks for each agent", async () => {
    const onAgentStart = vi.fn();
    const onAgentEnd = vi.fn();
    const onRoundStart = vi.fn();
    const onRoundEnd = vi.fn();

    const team = createTeam({
      name: "hooks-team",
      agents: [mockAgent("a", "A"), mockAgent("b", "B")],
      coordinationMode: "parallel",
      hooks: { onAgentStart, onAgentEnd, onRoundStart, onRoundEnd },
    } as ParallelConfig);

    await team.run("Task");

    expect(onRoundStart).toHaveBeenCalledWith(1);
    expect(onAgentStart).toHaveBeenCalledTimes(2);
    expect(onAgentEnd).toHaveBeenCalledTimes(2);
    expect(onRoundEnd).toHaveBeenCalledWith(1, expect.any(Array));
  });

  it("should execute agents concurrently (not sequentially)", async () => {
    const startTimes: number[] = [];

    const makeTimedAgent = (name: string): Agent => ({
      name,
      async run(): Promise<AgentResponse> {
        startTimes.push(Date.now());
        await new Promise((r) => setTimeout(r, 50));
        return { text: name, steps: [], toolCalls: [], usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }, agentName: name };
      },
    });

    const team = createTeam({
      name: "concurrent-team",
      agents: [makeTimedAgent("a"), makeTimedAgent("b"), makeTimedAgent("c")],
      coordinationMode: "parallel",
    } as ParallelConfig);

    await team.run("Task");

    // All agents should start within a tight window (concurrently)
    if (startTimes.length === 3) {
      const spread = Math.max(...startTimes) - Math.min(...startTimes);
      expect(spread).toBeLessThan(40); // All started nearly simultaneously
    }
  });
});

describe("aggregate function", () => {
  const responses: AgentResponse[] = [
    { text: "Hello", steps: [], toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, agentName: "a" },
    { text: "World", steps: [], toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, agentName: "b" },
  ];

  it("first-wins returns first response", () => {
    expect(aggregate("first-wins", responses)).toBe("Hello");
  });

  it("merge-all formats with agent names", () => {
    const result = aggregate("merge-all", responses);
    expect(result).toContain("[a]: Hello");
    expect(result).toContain("[b]: World");
  });

  it("majority-vote returns most common text", () => {
    const votingResponses: AgentResponse[] = [
      { text: "A", steps: [], toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, agentName: "1" },
      { text: "B", steps: [], toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, agentName: "2" },
      { text: "A", steps: [], toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, agentName: "3" },
    ];
    expect(aggregate("majority-vote", votingResponses)).toBe("A");
  });

  it("handles empty responses", () => {
    expect(aggregate("first-wins", [])).toBe("");
    expect(aggregate("merge-all", [])).toBe("");
    expect(aggregate("majority-vote", [])).toBe("");
  });
});
