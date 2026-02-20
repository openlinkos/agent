/**
 * Debate coordination mode.
 *
 * Agents argue positions over multiple rounds. Each agent sees all
 * previous arguments. Convergence detection stops early when agents
 * agree. An optional judge agent evaluates and picks a winner.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { Agent } from "@openlinkos/agent";
import type { TeamResult, TeamHooks, AgentRole } from "../types.js";
import { addUsage, emptyUsage } from "../utils.js";

// ---------------------------------------------------------------------------
// Convergence detection
// ---------------------------------------------------------------------------

/**
 * Simple convergence check: if all agents produce the same trimmed output
 * in a round, we consider them converged.
 */
function hasConverged(responses: AgentResponse[]): boolean {
  if (responses.length <= 1) return true;
  const first = responses[0].text.trim();
  return responses.every((r) => r.text.trim() === first);
}

// ---------------------------------------------------------------------------
// Run debate coordination
// ---------------------------------------------------------------------------

/**
 * Run debate coordination over multiple rounds.
 */
export async function runDebate(
  agents: AgentRole[],
  input: string,
  maxRounds: number,
  hooks: TeamHooks,
  judge?: Agent,
  debateRounds?: number,
  signal?: AbortSignal,
): Promise<TeamResult> {
  const rounds = debateRounds ?? maxRounds;
  const allResults: AgentResponse[] = [];
  let totalUsage = emptyUsage();

  // Track arguments across rounds
  const argumentHistory: Array<{ agentName: string; round: number; text: string }> = [];

  for (let round = 1; round <= rounds; round++) {
    // Check abort signal between rounds
    if (signal?.aborted) {
      break;
    }

    if (hooks.onRoundStart) {
      await hooks.onRoundStart(round);
    }

    const roundResults: AgentResponse[] = [];

    for (const { agent } of agents) {
      if (hooks.onAgentStart) {
        await hooks.onAgentStart(agent.name, round);
      }

      // Build input with full debate history
      let debateInput = `Original question: ${input}\n\n`;

      if (argumentHistory.length > 0) {
        debateInput += "Previous arguments:\n";
        for (const arg of argumentHistory) {
          debateInput += `\n[Round ${arg.round} - ${arg.agentName}]: ${arg.text}\n`;
        }
        debateInput += `\nRound ${round}: Please provide your argument, considering all previous positions.`;
      } else {
        debateInput += `Round ${round}: Please provide your initial argument.`;
      }

      let response: AgentResponse;
      try {
        response = await agent.run(debateInput, signal ? { signal } : undefined);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (hooks.onError) {
          await hooks.onError(error);
        }
        throw error;
      }

      roundResults.push(response);
      allResults.push(response);
      totalUsage = addUsage(totalUsage, response.usage);

      argumentHistory.push({
        agentName: agent.name,
        round,
        text: response.text,
      });

      if (hooks.onAgentEnd) {
        await hooks.onAgentEnd(agent.name, response, round);
      }
    }

    if (hooks.onRoundEnd) {
      await hooks.onRoundEnd(round, roundResults);
    }

    // Check convergence
    if (hasConverged(roundResults)) {
      if (hooks.onConsensus) {
        await hooks.onConsensus(round, roundResults[0].text);
      }

      return {
        finalOutput: roundResults[0].text,
        agentResults: allResults,
        rounds: round,
        totalUsage,
      };
    }
  }

  // No convergence — if we have a judge, let them decide
  if (judge) {
    if (hooks.onAgentStart) {
      await hooks.onAgentStart(judge.name, rounds + 1);
    }

    let judgeInput = `You are the judge. The following debate has concluded without consensus.\n\nOriginal question: ${input}\n\nArguments:\n`;
    for (const arg of argumentHistory) {
      judgeInput += `\n[Round ${arg.round} - ${arg.agentName}]: ${arg.text}\n`;
    }
    judgeInput += "\nPlease evaluate the arguments and provide your final verdict.";

    let judgeResponse: AgentResponse;
    try {
      judgeResponse = await judge.run(judgeInput, signal ? { signal } : undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (hooks.onError) {
        await hooks.onError(error);
      }
      throw error;
    }

    allResults.push(judgeResponse);
    totalUsage = addUsage(totalUsage, judgeResponse.usage);

    if (hooks.onAgentEnd) {
      await hooks.onAgentEnd(judge.name, judgeResponse, rounds + 1);
    }

    return {
      finalOutput: judgeResponse.text,
      agentResults: allResults,
      rounds,
      totalUsage,
    };
  }

  // No judge — return the last round's merged output
  const lastRoundResults = allResults.slice(-agents.length);
  const finalOutput = lastRoundResults
    .map((r) => `[${r.agentName}]: ${r.text}`)
    .join("\n\n");

  return {
    finalOutput,
    agentResults: allResults,
    rounds,
    totalUsage,
  };
}
