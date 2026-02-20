/**
 * Tests for supervisor coordination mode.
 */

import { describe, it, expect, vi } from "vitest";
import { createTeam } from "../src/team.js";
import type { SupervisorConfig, TeamHooks } from "../src/types.js";
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

describe("Supervisor coordination mode", () => {
  it("should delegate tasks to workers via [DELEGATE] directive", async () => {
    const supervisor = mockAgent(
      "supervisor",
      "[DELEGATE: researcher] Find information about AI",
    );
    const researcher = mockAgent("researcher", "AI is a field of computer science");
    // Second round: supervisor gives final answer
    let supervisorCallCount = 0;
    const dynamicSupervisor: Agent = {
      name: "supervisor",
      async run(): Promise<AgentResponse> {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          return {
            text: "[DELEGATE: researcher] Find information about AI",
            steps: [],
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            agentName: "supervisor",
          };
        }
        return {
          text: "[FINAL] AI is a growing field of computer science.",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "supervisor",
        };
      },
    };

    const team = createTeam({
      name: "supervisor-team",
      agents: [dynamicSupervisor, researcher],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Tell me about AI");

    expect(result.finalOutput).toBe("AI is a growing field of computer science.");
    expect(result.agentResults.length).toBeGreaterThanOrEqual(2);
  });

  it("should use first agent as supervisor when no supervisor specified", async () => {
    const agentNames: string[] = [];

    const sup: Agent = {
      name: "default-sup",
      async run(): Promise<AgentResponse> {
        agentNames.push("default-sup");
        return {
          text: "[FINAL] Done by default supervisor",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "default-sup",
        };
      },
    };

    const worker = mockAgent("worker", "Worker result");

    const team = createTeam({
      name: "default-sup-team",
      agents: [sup, worker],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Done by default supervisor");
    expect(agentNames).toContain("default-sup");
  });

  it("should use separately specified supervisor", async () => {
    const externalSup = mockAgent("ext-sup", "[FINAL] External supervisor result");
    const worker = mockAgent("worker", "Worker result");

    const team = createTeam({
      name: "ext-sup-team",
      agents: [worker],
      coordinationMode: "supervisor",
      supervisor: externalSup,
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("External supervisor result");
  });

  it("should handle supervisor with no delegations as final output", async () => {
    const sup = mockAgent("sup", "Direct answer without delegation");

    const team = createTeam({
      name: "no-delegate-team",
      agents: [sup, mockAgent("w", "Worker")],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Simple question");

    expect(result.finalOutput).toBe("Direct answer without delegation");
    expect(result.rounds).toBe(1);
  });

  it("should handle multiple delegations in single round", async () => {
    let supCallCount = 0;
    const sup: Agent = {
      name: "sup",
      async run(): Promise<AgentResponse> {
        supCallCount++;
        if (supCallCount === 1) {
          return {
            text: "[DELEGATE: researcher] Research topic A\n[DELEGATE: writer] Write about topic B",
            steps: [],
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            agentName: "sup",
          };
        }
        return {
          text: "[FINAL] Combined result",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "sup",
        };
      },
    };

    const researcher = mockAgent("researcher", "Research result");
    const writer = mockAgent("writer", "Writing result");

    const team = createTeam({
      name: "multi-delegate-team",
      agents: [sup, researcher, writer],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Complex task");

    expect(result.finalOutput).toBe("Combined result");
    // sup (round 1) + researcher + writer + sup (round 2) = 4
    expect(result.agentResults).toHaveLength(4);
  });

  it("should handle delegation to unknown agent", async () => {
    let supCallCount = 0;
    const sup: Agent = {
      name: "sup",
      async run(input: string): Promise<AgentResponse> {
        supCallCount++;
        if (supCallCount === 1) {
          return {
            text: "[DELEGATE: nonexistent] Do something",
            steps: [],
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            agentName: "sup",
          };
        }
        // After getting error feedback, produce final answer
        return {
          text: "[FINAL] Agent not found, handling myself",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "sup",
        };
      },
    };

    const team = createTeam({
      name: "unknown-agent-team",
      agents: [sup, mockAgent("worker", "Worker")],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Agent not found, handling myself");
  });

  it("should respect maxRounds", async () => {
    // Supervisor never gives [FINAL]
    const sup = mockAgent("sup", "[DELEGATE: worker] Do work");
    const worker = mockAgent("worker", "Worker result");

    const team = createTeam({
      name: "max-rounds-team",
      agents: [sup, worker],
      coordinationMode: "supervisor",
      maxRounds: 2,
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.rounds).toBe(2);
  });

  it("should aggregate usage across supervisor and workers", async () => {
    const sup = mockAgent("sup", "[FINAL] Done");

    const team = createTeam({
      name: "usage-sup-team",
      agents: [sup, mockAgent("w", "W")],
      coordinationMode: "supervisor",
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.totalUsage.totalTokens).toBe(15); // Only supervisor ran
  });

  it("should call hooks during delegation", async () => {
    const onRoundStart = vi.fn();
    const onAgentStart = vi.fn();
    const onAgentEnd = vi.fn();
    const onRoundEnd = vi.fn();

    let supCallCount = 0;
    const sup: Agent = {
      name: "sup",
      async run(): Promise<AgentResponse> {
        supCallCount++;
        if (supCallCount === 1) {
          return {
            text: "[DELEGATE: worker] Do it",
            steps: [],
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            agentName: "sup",
          };
        }
        return {
          text: "[FINAL] Done",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "sup",
        };
      },
    };

    const worker = mockAgent("worker", "Worker result");

    const team = createTeam({
      name: "hooks-sup-team",
      agents: [sup, worker],
      coordinationMode: "supervisor",
      hooks: { onRoundStart, onAgentStart, onAgentEnd, onRoundEnd },
    } as SupervisorConfig);

    await team.run("Test");

    expect(onRoundStart).toHaveBeenCalled();
    expect(onAgentStart).toHaveBeenCalled();
    expect(onAgentEnd).toHaveBeenCalled();
    expect(onRoundEnd).toHaveBeenCalled();
  });

  it("should propagate supervisor errors", async () => {
    const failSup: Agent = {
      name: "fail-sup",
      async run(): Promise<AgentResponse> {
        throw new Error("Supervisor crashed");
      },
    };

    const onError = vi.fn();

    const team = createTeam({
      name: "error-sup-team",
      agents: [failSup, mockAgent("w", "W")],
      coordinationMode: "supervisor",
      hooks: { onError },
    } as SupervisorConfig);

    await expect(team.run("Test")).rejects.toThrow("Supervisor crashed");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should handle worker errors gracefully and feed back to supervisor", async () => {
    let supCallCount = 0;
    const sup: Agent = {
      name: "sup",
      async run(input: string): Promise<AgentResponse> {
        supCallCount++;
        if (supCallCount === 1) {
          return {
            text: "[DELEGATE: bad-worker] Do something",
            steps: [],
            toolCalls: [],
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            agentName: "sup",
          };
        }
        return {
          text: "[FINAL] Handled the error",
          steps: [],
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          agentName: "sup",
        };
      },
    };

    const badWorker: Agent = {
      name: "bad-worker",
      async run(): Promise<AgentResponse> {
        throw new Error("Worker blew up");
      },
    };

    const onError = vi.fn();

    const team = createTeam({
      name: "worker-error-team",
      agents: [sup, badWorker],
      coordinationMode: "supervisor",
      hooks: { onError },
    } as SupervisorConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Handled the error");
    expect(onError).toHaveBeenCalled();
  });
});
