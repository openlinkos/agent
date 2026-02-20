/**
 * Tests for debate coordination mode.
 */

import { describe, it, expect, vi } from "vitest";
import { createTeam } from "../src/team.js";
import type { DebateConfig, TeamHooks } from "../src/types.js";
import type { Agent, AgentResponse } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockAgent(name: string, text: string): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      return {
        text,
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        agentName: name,
      };
    },
  };
}

function mockDynamicAgent(name: string, fn: (input: string) => string): Agent {
  return {
    name,
    async run(input: string): Promise<AgentResponse> {
      return {
        text: fn(input),
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        agentName: name,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Debate coordination mode", () => {
  it("should run multiple debate rounds", async () => {
    const roundsSeen: number[] = [];

    const agentA = mockDynamicAgent("debater-a", (input) => {
      if (input.includes("Round 1")) roundsSeen.push(1);
      if (input.includes("Round 2")) roundsSeen.push(2);
      return "Position A";
    });
    const agentB = mockDynamicAgent("debater-b", (input) => {
      if (input.includes("Round 1")) roundsSeen.push(1);
      if (input.includes("Round 2")) roundsSeen.push(2);
      return "Position B";
    });

    const team = createTeam({
      name: "debate-team",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 2,
    } as DebateConfig);

    const result = await team.run("Should we use X?");

    expect(result.rounds).toBe(2);
    // 2 agents × 2 rounds = 4 agent results
    expect(result.agentResults).toHaveLength(4);
  });

  it("should pass debate history to each agent", async () => {
    const receivedInputs: string[] = [];

    const agentA = mockDynamicAgent("a", (input) => {
      receivedInputs.push(input);
      return "A says yes";
    });
    const agentB = mockDynamicAgent("b", (input) => {
      receivedInputs.push(input);
      return "B says no";
    });

    const team = createTeam({
      name: "history-debate",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 2,
    } as DebateConfig);

    await team.run("Topic");

    // In round 2, agents should see round 1 arguments
    const round2Inputs = receivedInputs.slice(2);
    expect(round2Inputs[0]).toContain("A says yes");
    expect(round2Inputs[0]).toContain("B says no");
  });

  it("should detect convergence and stop early", async () => {
    // Both agents agree from the start
    const agentA = mockAgent("a", "Agreed answer");
    const agentB = mockAgent("b", "Agreed answer");

    const onConsensus = vi.fn();

    const team = createTeam({
      name: "converge-team",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 5,
      hooks: { onConsensus },
    } as DebateConfig);

    const result = await team.run("Topic");

    expect(result.rounds).toBe(1); // Stopped at round 1
    expect(result.finalOutput).toBe("Agreed answer");
    expect(onConsensus).toHaveBeenCalledWith(1, "Agreed answer");
  });

  it("should use judge when no convergence", async () => {
    const agentA = mockAgent("a", "Position A");
    const agentB = mockAgent("b", "Position B");
    const judge = mockDynamicAgent("judge", (input) => {
      // Judge should see both positions
      if (input.includes("Position A") && input.includes("Position B")) {
        return "Position A wins";
      }
      return "Cannot decide";
    });

    const team = createTeam({
      name: "judged-debate",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 2,
      judge,
    } as DebateConfig);

    const result = await team.run("Topic");

    expect(result.finalOutput).toBe("Position A wins");
    // 2 agents × 2 rounds + 1 judge = 5
    expect(result.agentResults).toHaveLength(5);
  });

  it("should merge outputs when no convergence and no judge", async () => {
    const agentA = mockAgent("a", "View A");
    const agentB = mockAgent("b", "View B");

    const team = createTeam({
      name: "no-judge-debate",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 1,
    } as DebateConfig);

    const result = await team.run("Topic");

    expect(result.finalOutput).toContain("[a]: View A");
    expect(result.finalOutput).toContain("[b]: View B");
  });

  it("should aggregate usage across all rounds and judge", async () => {
    const agentA = mockAgent("a", "A");
    const agentB = mockAgent("b", "B");
    const judge = mockAgent("judge", "Judge says A");

    const team = createTeam({
      name: "usage-debate",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      rounds: 2,
      judge,
    } as DebateConfig);

    const result = await team.run("Topic");

    // 2 agents × 2 rounds + 1 judge = 5 responses × 15 tokens each = 75
    expect(result.totalUsage.totalTokens).toBe(75);
  });

  it("should call hooks for rounds and agents", async () => {
    const onRoundStart = vi.fn();
    const onRoundEnd = vi.fn();
    const onAgentStart = vi.fn();
    const onAgentEnd = vi.fn();

    const hooks: TeamHooks = { onRoundStart, onRoundEnd, onAgentStart, onAgentEnd };

    const team = createTeam({
      name: "hooks-debate",
      agents: [mockAgent("a", "A"), mockAgent("b", "B")],
      coordinationMode: "debate",
      rounds: 2,
      hooks,
    } as DebateConfig);

    await team.run("Topic");

    expect(onRoundStart).toHaveBeenCalledTimes(2);
    expect(onRoundEnd).toHaveBeenCalledTimes(2);
    expect(onAgentStart).toHaveBeenCalledTimes(4); // 2 agents × 2 rounds
    expect(onAgentEnd).toHaveBeenCalledTimes(4);
  });

  it("should propagate agent errors with onError hook", async () => {
    const failAgent: Agent = {
      name: "fail",
      async run(): Promise<AgentResponse> {
        throw new Error("Debate failed");
      },
    };

    const onError = vi.fn();

    const team = createTeam({
      name: "error-debate",
      agents: [failAgent, mockAgent("b", "B")],
      coordinationMode: "debate",
      rounds: 1,
      hooks: { onError },
    } as DebateConfig);

    await expect(team.run("Topic")).rejects.toThrow("Debate failed");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should default to maxRounds when rounds is not specified", async () => {
    const agentA = mockAgent("a", "A");
    const agentB = mockAgent("b", "B");

    const team = createTeam({
      name: "default-rounds",
      agents: [agentA, agentB],
      coordinationMode: "debate",
      maxRounds: 1,
    } as DebateConfig);

    const result = await team.run("Topic");

    // Should run 1 round (from maxRounds)
    expect(result.rounds).toBe(1);
  });
});
