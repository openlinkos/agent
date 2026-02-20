/**
 * Sequential (pipeline) coordination mode.
 *
 * Agents execute in order. Each agent receives the previous agent's output
 * as additional context. Early exit if an agent signals completion via
 * the "[DONE]" marker in its output.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { TeamResult, TeamHooks, AgentRole } from "../types.js";
import { aggregateUsage } from "../utils.js";

const DONE_MARKER = "[DONE]";

/**
 * Run sequential coordination: Agent A → Agent B → Agent C.
 */
export async function runSequential(
  agents: AgentRole[],
  input: string,
  maxRounds: number,
  hooks: TeamHooks,
  signal?: AbortSignal,
): Promise<TeamResult> {
  const agentResults: AgentResponse[] = [];
  let currentInput = input;
  const effectiveAgents = agents.slice(0, maxRounds);

  if (hooks.onRoundStart) {
    await hooks.onRoundStart(1);
  }

  for (let i = 0; i < effectiveAgents.length; i++) {
    // Check abort signal between agents
    if (signal?.aborted) {
      break;
    }

    const { agent } = effectiveAgents[i];

    if (hooks.onAgentStart) {
      await hooks.onAgentStart(agent.name, i + 1);
    }

    let response: AgentResponse;
    try {
      response = await agent.run(currentInput, signal ? { signal } : undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (hooks.onError) {
        await hooks.onError(error);
      }
      throw error;
    }

    agentResults.push(response);

    if (hooks.onAgentEnd) {
      await hooks.onAgentEnd(agent.name, response, i + 1);
    }

    // Early exit if the agent signals completion
    if (response.text.includes(DONE_MARKER)) {
      break;
    }

    // Pass output as input to the next agent
    currentInput = `Previous agent (${agent.name}) output:\n${response.text}\n\nOriginal task: ${input}`;
  }

  if (hooks.onRoundEnd) {
    await hooks.onRoundEnd(1, agentResults);
  }

  const lastResponse = agentResults[agentResults.length - 1];

  return {
    finalOutput: lastResponse?.text ?? "",
    agentResults,
    rounds: 1,
    totalUsage: aggregateUsage(agentResults),
  };
}
