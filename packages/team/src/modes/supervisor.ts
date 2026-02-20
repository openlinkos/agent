/**
 * Supervisor coordination mode.
 *
 * One supervisor agent delegates tasks to worker agents.
 * The supervisor decides which agent handles what, when to combine results,
 * and can spawn sub-tasks mid-execution over multiple rounds.
 *
 * Protocol:
 * - Supervisor receives the task and list of available workers.
 * - Supervisor's output is parsed for delegation directives:
 *   `[DELEGATE: agentName] task description`
 * - Worker results are fed back to the supervisor.
 * - Supervisor produces final output when it outputs `[FINAL] ...`.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { TeamResult, TeamHooks, AgentRole } from "../types.js";
import type { Agent } from "@openlinkos/agent";
import { addUsage, emptyUsage } from "../utils.js";

// ---------------------------------------------------------------------------
// Directive parsing
// ---------------------------------------------------------------------------

interface Delegation {
  agentName: string;
  task: string;
}

const DELEGATE_PATTERN = /\[DELEGATE:\s*([^\]]+)\]\s*(.+)/;
const FINAL_PATTERN = /\[FINAL\]\s*([\s\S]*)/;

function parseDelegations(text: string): Delegation[] {
  const delegations: Delegation[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(DELEGATE_PATTERN.source, "g");
  while ((match = pattern.exec(text)) !== null) {
    delegations.push({
      agentName: match[1].trim(),
      task: match[2].trim(),
    });
  }
  return delegations;
}

function parseFinalOutput(text: string): string | null {
  const match = FINAL_PATTERN.exec(text);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Run supervisor coordination
// ---------------------------------------------------------------------------

/**
 * Run supervisor coordination.
 */
export async function runSupervisor(
  agents: AgentRole[],
  input: string,
  maxRounds: number,
  hooks: TeamHooks,
  supervisorAgent?: Agent,
  signal?: AbortSignal,
): Promise<TeamResult> {
  // Determine supervisor and workers
  const supervisor = supervisorAgent ?? agents[0]?.agent;
  if (!supervisor) {
    throw new Error("Supervisor mode requires at least one agent.");
  }

  const workerMap = new Map<string, Agent>();
  for (const { agent } of agents) {
    if (agent.name !== supervisor.name) {
      workerMap.set(agent.name, agent);
    }
  }
  // If the supervisor was passed separately (not in agents list), add all agents as workers
  if (!agents.some((a) => a.agent.name === supervisor.name)) {
    for (const { agent } of agents) {
      workerMap.set(agent.name, agent);
    }
  }

  const workerNames = [...workerMap.keys()];
  const allResults: AgentResponse[] = [];
  let totalUsage = emptyUsage();

  // Build initial supervisor prompt
  let supervisorInput =
    `You are the supervisor. Delegate tasks to your worker agents or provide a final answer.\n\n` +
    `Available workers: ${workerNames.join(", ")}\n\n` +
    `To delegate, use: [DELEGATE: agentName] task description\n` +
    `To give the final answer, use: [FINAL] your final answer\n\n` +
    `Task: ${input}`;

  for (let round = 1; round <= maxRounds; round++) {
    // Check abort signal between rounds
    if (signal?.aborted) {
      break;
    }

    if (hooks.onRoundStart) {
      await hooks.onRoundStart(round);
    }

    // Supervisor decides
    if (hooks.onAgentStart) {
      await hooks.onAgentStart(supervisor.name, round);
    }

    let supervisorResponse: AgentResponse;
    try {
      supervisorResponse = await supervisor.run(supervisorInput, signal ? { signal } : undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (hooks.onError) {
        await hooks.onError(error);
      }
      throw error;
    }

    allResults.push(supervisorResponse);
    totalUsage = addUsage(totalUsage, supervisorResponse.usage);

    if (hooks.onAgentEnd) {
      await hooks.onAgentEnd(supervisor.name, supervisorResponse, round);
    }

    // Check for final output
    const finalOutput = parseFinalOutput(supervisorResponse.text);
    if (finalOutput !== null) {
      if (hooks.onRoundEnd) {
        await hooks.onRoundEnd(round, [supervisorResponse]);
      }

      return {
        finalOutput,
        agentResults: allResults,
        rounds: round,
        totalUsage,
      };
    }

    // Parse delegations
    const delegations = parseDelegations(supervisorResponse.text);

    if (delegations.length === 0) {
      // No delegations and no final marker — treat entire output as final
      if (hooks.onRoundEnd) {
        await hooks.onRoundEnd(round, [supervisorResponse]);
      }

      return {
        finalOutput: supervisorResponse.text,
        agentResults: allResults,
        rounds: round,
        totalUsage,
      };
    }

    // Execute delegations
    const workerResults: Array<{ agentName: string; text: string }> = [];

    for (const delegation of delegations) {
      const worker = workerMap.get(delegation.agentName);
      if (!worker) {
        workerResults.push({
          agentName: delegation.agentName,
          text: `Error: Agent "${delegation.agentName}" not found. Available: ${workerNames.join(", ")}`,
        });
        continue;
      }

      if (hooks.onAgentStart) {
        await hooks.onAgentStart(worker.name, round);
      }

      let workerResponse: AgentResponse;
      try {
        workerResponse = await worker.run(delegation.task, signal ? { signal } : undefined);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (hooks.onError) {
          await hooks.onError(error);
        }
        workerResults.push({
          agentName: delegation.agentName,
          text: `Error: ${error.message}`,
        });
        continue;
      }

      allResults.push(workerResponse);
      totalUsage = addUsage(totalUsage, workerResponse.usage);
      workerResults.push({
        agentName: delegation.agentName,
        text: workerResponse.text,
      });

      if (hooks.onAgentEnd) {
        await hooks.onAgentEnd(worker.name, workerResponse, round);
      }
    }

    if (hooks.onRoundEnd) {
      await hooks.onRoundEnd(round, allResults.slice(-delegations.length - 1));
    }

    // Feed worker results back to supervisor
    supervisorInput =
      `Worker results from round ${round}:\n\n` +
      workerResults
        .map((r) => `[${r.agentName}]: ${r.text}`)
        .join("\n\n") +
      `\n\nOriginal task: ${input}\n\n` +
      `Continue delegating or provide [FINAL] answer.`;
  }

  // Max rounds reached — return last supervisor output as final
  const lastResult = allResults[allResults.length - 1];
  return {
    finalOutput: lastResult?.text ?? "",
    agentResults: allResults,
    rounds: maxRounds,
    totalUsage,
  };
}
