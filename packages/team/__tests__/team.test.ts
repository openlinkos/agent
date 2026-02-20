/**
 * Tests for the createTeam factory, hooks, usage tracking, and shared context.
 */

import { describe, it, expect, vi } from "vitest";
import { createTeam } from "../src/team.js";
import { normalizeAgents, emptyUsage, addUsage, aggregateUsage } from "../src/utils.js";
import type {
  TeamConfig,
  TeamHooks,
  CustomConfig,
  AgentRole,
  TeamResult,
  TeamContext,
} from "../src/types.js";
import type { Agent, AgentResponse, Usage } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockAgent(name: string, text: string, usage: Usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }): Agent {
  return {
    name,
    async run(): Promise<AgentResponse> {
      return { text, steps: [], toolCalls: [], usage, agentName: name };
    },
  };
}

// ---------------------------------------------------------------------------
// createTeam factory tests
// ---------------------------------------------------------------------------

describe("createTeam", () => {
  it("should create a team with the given name and mode", () => {
    const team = createTeam({
      name: "my-team",
      agents: [mockAgent("a", "A")],
      coordinationMode: "sequential",
    });

    expect(team.name).toBe("my-team");
    expect(team.coordinationMode).toBe("sequential");
  });

  it("should throw when no agents are provided", () => {
    expect(() =>
      createTeam({
        name: "empty-team",
        agents: [],
        coordinationMode: "sequential",
      }),
    ).toThrow("at least one agent");
  });

  it("should throw for unknown coordination mode", async () => {
    const team = createTeam({
      name: "bad-mode",
      agents: [mockAgent("a", "A")],
      coordinationMode: "unknown" as any,
    });

    await expect(team.run("Test")).rejects.toThrow("Unknown coordination mode");
  });

  it("should support all coordination modes", async () => {
    const modes = ["sequential", "parallel", "debate", "supervisor"] as const;

    for (const mode of modes) {
      const team = createTeam({
        name: `${mode}-team`,
        agents: [mockAgent("a", `${mode} result`)],
        coordinationMode: mode,
      });

      const result = await team.run("Test");
      expect(result.finalOutput).toBeTruthy();
    }
  });

  it("should support custom mode with coordination function", async () => {
    const team = createTeam({
      name: "custom-team",
      agents: [mockAgent("a", "A")],
      coordinationMode: "custom",
      coordinationFn: async (agents, input, _context) => {
        const responses: AgentResponse[] = [];
        for (const { agent } of agents) {
          const r = await agent.run(input);
          responses.push(r);
        }
        return {
          finalOutput: `Custom: ${responses.map((r) => r.text).join(", ")}`,
          agentResults: responses,
          rounds: 1,
          totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      },
    } as CustomConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Custom: A");
  });

  it("should throw for custom mode without coordinationFn", async () => {
    const team = createTeam({
      name: "bad-custom",
      agents: [mockAgent("a", "A")],
      coordinationMode: "custom",
    });

    await expect(team.run("Test")).rejects.toThrow("coordinationFn");
  });
});

// ---------------------------------------------------------------------------
// Hooks integration tests
// ---------------------------------------------------------------------------

describe("Team hooks", () => {
  it("should call onError when an agent fails", async () => {
    const onError = vi.fn();
    const failAgent: Agent = {
      name: "fail",
      async run(): Promise<AgentResponse> {
        throw new Error("Agent failed");
      },
    };

    const team = createTeam({
      name: "error-team",
      agents: [failAgent],
      coordinationMode: "sequential",
      hooks: { onError },
    });

    await expect(team.run("Test")).rejects.toThrow("Agent failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should call onRoundStart and onRoundEnd", async () => {
    const onRoundStart = vi.fn();
    const onRoundEnd = vi.fn();

    const team = createTeam({
      name: "round-hooks-team",
      agents: [mockAgent("a", "A")],
      coordinationMode: "sequential",
      hooks: { onRoundStart, onRoundEnd },
    });

    await team.run("Test");

    expect(onRoundStart).toHaveBeenCalledWith(1);
    expect(onRoundEnd).toHaveBeenCalledWith(1, expect.any(Array));
  });

  it("should call onAgentStart and onAgentEnd for each agent", async () => {
    const onAgentStart = vi.fn();
    const onAgentEnd = vi.fn();

    const team = createTeam({
      name: "agent-hooks-team",
      agents: [mockAgent("a", "A"), mockAgent("b", "B")],
      coordinationMode: "sequential",
      hooks: { onAgentStart, onAgentEnd },
    });

    await team.run("Test");

    expect(onAgentStart).toHaveBeenCalledWith("a", expect.any(Number));
    expect(onAgentStart).toHaveBeenCalledWith("b", expect.any(Number));
    expect(onAgentEnd).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Usage tracking tests
// ---------------------------------------------------------------------------

describe("Usage tracking", () => {
  it("should track total usage across all agents", async () => {
    const team = createTeam({
      name: "usage-team",
      agents: [
        mockAgent("a", "A", { promptTokens: 10, completionTokens: 5, totalTokens: 15 }),
        mockAgent("b", "B", { promptTokens: 20, completionTokens: 10, totalTokens: 30 }),
        mockAgent("c", "C", { promptTokens: 30, completionTokens: 15, totalTokens: 45 }),
      ],
      coordinationMode: "sequential",
    });

    const result = await team.run("Test");

    expect(result.totalUsage.promptTokens).toBe(60);
    expect(result.totalUsage.completionTokens).toBe(30);
    expect(result.totalUsage.totalTokens).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Shared context / custom mode tests
// ---------------------------------------------------------------------------

describe("Shared context and custom coordination", () => {
  it("should provide blackboard in custom mode", async () => {
    const team = createTeam({
      name: "blackboard-team",
      agents: [mockAgent("a", "A")],
      coordinationMode: "custom",
      coordinationFn: async (agents, input, context) => {
        context.blackboard.set("key", "value");
        const val = context.blackboard.get("key");
        return {
          finalOutput: `Blackboard value: ${val}`,
          agentResults: [],
          rounds: 1,
          totalUsage: emptyUsage(),
        };
      },
    } as CustomConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Blackboard value: value");
  });

  it("should provide message bus in custom mode", async () => {
    const team = createTeam({
      name: "message-team",
      agents: [mockAgent("a", "A"), mockAgent("b", "B")],
      coordinationMode: "custom",
      coordinationFn: async (agents, input, context) => {
        context.sendMessage("a", "b", "Hello from A");
        const messages = context.getMessages("b");
        return {
          finalOutput: `Messages for b: ${messages.map((m) => m.content).join(", ")}`,
          agentResults: [],
          rounds: 1,
          totalUsage: emptyUsage(),
        };
      },
    } as CustomConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Messages for b: Hello from A");
  });

  it("should give custom function access to agents with roles", async () => {
    const team = createTeam({
      name: "roles-team",
      agents: [
        {
          agent: mockAgent("research-agent", "Research data"),
          role: "researcher",
          description: "Researches topics",
          canDelegate: false,
        },
      ],
      coordinationMode: "custom",
      coordinationFn: async (agents, _input, _context) => {
        const roles = agents.map((a) => a.role);
        return {
          finalOutput: `Roles: ${roles.join(", ")}`,
          agentResults: [],
          rounds: 1,
          totalUsage: emptyUsage(),
        };
      },
    } as CustomConfig);

    const result = await team.run("Test");

    expect(result.finalOutput).toBe("Roles: researcher");
  });
});

// ---------------------------------------------------------------------------
// Utility tests
// ---------------------------------------------------------------------------

describe("normalizeAgents", () => {
  it("should convert plain agents to AgentRole", () => {
    const agent = mockAgent("test", "Output");
    const roles = normalizeAgents([agent]);

    expect(roles).toHaveLength(1);
    expect(roles[0].agent).toBe(agent);
    expect(roles[0].role).toBe("test");
    expect(roles[0].canDelegate).toBe(false);
  });

  it("should pass through AgentRole objects", () => {
    const agent = mockAgent("test", "Output");
    const role: AgentRole = {
      agent,
      role: "custom-role",
      description: "Custom",
      canDelegate: true,
    };

    const roles = normalizeAgents([role]);

    expect(roles).toHaveLength(1);
    expect(roles[0].role).toBe("custom-role");
    expect(roles[0].canDelegate).toBe(true);
  });

  it("should handle mixed agents and roles", () => {
    const plainAgent = mockAgent("plain", "P");
    const roleAgent: AgentRole = {
      agent: mockAgent("roled", "R"),
      role: "special",
    };

    const roles = normalizeAgents([plainAgent, roleAgent]);

    expect(roles).toHaveLength(2);
    expect(roles[0].role).toBe("plain");
    expect(roles[1].role).toBe("special");
  });
});

describe("Usage utilities", () => {
  it("emptyUsage should return zeroed usage", () => {
    const u = emptyUsage();
    expect(u.promptTokens).toBe(0);
    expect(u.completionTokens).toBe(0);
    expect(u.totalTokens).toBe(0);
  });

  it("addUsage should sum two usage objects", () => {
    const a: Usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const b: Usage = { promptTokens: 20, completionTokens: 10, totalTokens: 30 };
    const sum = addUsage(a, b);

    expect(sum.promptTokens).toBe(30);
    expect(sum.completionTokens).toBe(15);
    expect(sum.totalTokens).toBe(45);
  });

  it("aggregateUsage should sum across responses", () => {
    const responses: AgentResponse[] = [
      { text: "A", steps: [], toolCalls: [], usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }, agentName: "a" },
      { text: "B", steps: [], toolCalls: [], usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 }, agentName: "b" },
    ];
    const total = aggregateUsage(responses);

    expect(total.promptTokens).toBe(20);
    expect(total.completionTokens).toBe(15);
    expect(total.totalTokens).toBe(35);
  });
});
