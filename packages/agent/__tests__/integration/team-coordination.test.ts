/**
 * Integration tests: team coordination with real agent instances.
 *
 * Tests createTeam with real (mock-model) agents exercising
 * sequential, parallel, and debate coordination modes.
 */

import { describe, it, expect } from "vitest";
import { createAgent } from "../../src/index.js";
import type { Agent } from "../../src/types.js";
import type { Model } from "@openlinkos/ai";
import type { ModelResponse } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import { createTeam } from "../../../team/src/team.js";

// ---------------------------------------------------------------------------
// Mock model helpers
// ---------------------------------------------------------------------------

function createMockModel(textResponse: string): Model {
  return {
    modelId: "mock:team-test",
    async generate(): Promise<ModelResponse> {
      return {
        text: textResponse,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Not implemented");
    },
    async generateWithTools(): Promise<ModelResponse> {
      return {
        text: textResponse,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
  };
}

function makeAgent(name: string, response: string): Agent {
  return createAgent({
    name,
    model: createMockModel(response),
    systemPrompt: `You are ${name}.`,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent Integration: team coordination", () => {
  it("should run agents in sequential (pipeline) mode", async () => {
    const agent1 = makeAgent("writer", "Draft: The quick brown fox.");
    const agent2 = makeAgent("editor", "Edited: The fast brown fox jumps.");

    const team = createTeam({
      name: "writing-team",
      agents: [agent1, agent2],
      coordinationMode: "sequential",
    });

    expect(team.name).toBe("writing-team");
    expect(team.coordinationMode).toBe("sequential");

    const result = await team.run("Write about a fox.");

    expect(result.agentResults.length).toBeGreaterThanOrEqual(2);
    // In sequential mode, the final output comes from the last agent
    expect(result.finalOutput).toBeTruthy();
    expect(result.totalUsage.totalTokens).toBeGreaterThan(0);
  });

  it("should run agents in parallel mode", async () => {
    const agents = [
      makeAgent("analyst-1", "Analysis A: positive outlook"),
      makeAgent("analyst-2", "Analysis B: cautious outlook"),
      makeAgent("analyst-3", "Analysis C: neutral outlook"),
    ];

    const team = createTeam({
      name: "analysis-team",
      agents,
      coordinationMode: "parallel",
    });

    const result = await team.run("Analyze the market.");

    expect(result.agentResults).toHaveLength(3);
    expect(result.finalOutput).toBeTruthy();
    expect(result.totalUsage.totalTokens).toBeGreaterThan(0);
  });

  it("should run agents in debate mode", async () => {
    const debater1 = makeAgent("pro", "I argue in favor: strong evidence supports this.");
    const debater2 = makeAgent("con", "I argue against: the risks outweigh benefits.");

    const team = createTeam({
      name: "debate-team",
      agents: [debater1, debater2],
      coordinationMode: "debate",
      maxRounds: 2,
    });

    const result = await team.run("Should we adopt this policy?");

    expect(result.agentResults.length).toBeGreaterThanOrEqual(2);
    expect(result.finalOutput).toBeTruthy();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
  });

  it("should handle team lifecycle hooks", async () => {
    const hooksCalled: string[] = [];

    const agents = [
      makeAgent("agent-a", "Response A"),
      makeAgent("agent-b", "Response B"),
    ];

    const team = createTeam({
      name: "hooked-team",
      agents,
      coordinationMode: "sequential",
      hooks: {
        onRoundStart: (round) => { hooksCalled.push(`round-start:${round}`); },
        onAgentStart: (name) => { hooksCalled.push(`agent-start:${name}`); },
        onAgentEnd: (name) => { hooksCalled.push(`agent-end:${name}`); },
        onRoundEnd: (round) => { hooksCalled.push(`round-end:${round}`); },
      },
    });

    await team.run("Test hooks.");

    expect(hooksCalled.some((h) => h.startsWith("round-start"))).toBe(true);
    expect(hooksCalled.some((h) => h.startsWith("agent-start"))).toBe(true);
    expect(hooksCalled.some((h) => h.startsWith("agent-end"))).toBe(true);
    expect(hooksCalled.some((h) => h.startsWith("round-end"))).toBe(true);
  });

  it("should work with role-assigned agents", async () => {
    const researcher = makeAgent("researcher", "Research findings: data is valid.");
    const summarizer = makeAgent("summarizer", "Summary: data validated successfully.");

    const team = createTeam({
      name: "role-team",
      agents: [
        { agent: researcher, role: "researcher", description: "Researches the topic" },
        { agent: summarizer, role: "summarizer", description: "Summarizes findings" },
      ],
      coordinationMode: "sequential",
    });

    const result = await team.run("Research and summarize the topic.");

    expect(result.agentResults.length).toBeGreaterThanOrEqual(2);
    expect(result.finalOutput).toBeTruthy();
  });
});
