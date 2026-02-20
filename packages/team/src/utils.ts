/**
 * Shared utilities for the team package.
 */

import type { Agent, AgentResponse, Usage } from "@openlinkos/agent";
import type { AgentRole } from "./types.js";

/**
 * Normalize a mixed array of Agent | AgentRole into AgentRole[].
 */
export function normalizeAgents(
  agents: Array<Agent | AgentRole>,
): AgentRole[] {
  return agents.map((entry) => {
    if ("agent" in entry && "role" in entry) {
      return entry as AgentRole;
    }
    const agent = entry as Agent;
    return {
      agent,
      role: agent.name,
      description: undefined,
      canDelegate: false,
    };
  });
}

/** Create an empty Usage object. */
export function emptyUsage(): Usage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

/** Add two Usage objects together. */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** Aggregate usage across multiple agent responses. */
export function aggregateUsage(responses: AgentResponse[]): Usage {
  return responses.reduce<Usage>(
    (acc, r) => addUsage(acc, r.usage),
    emptyUsage(),
  );
}

/** Get the agent name from an Agent or AgentRole. */
export function getAgentName(entry: Agent | AgentRole): string {
  if ("agent" in entry && "role" in entry) {
    return (entry as AgentRole).agent.name;
  }
  return (entry as Agent).name;
}
