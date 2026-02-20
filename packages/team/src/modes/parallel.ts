/**
 * Parallel coordination mode.
 *
 * All agents execute simultaneously on the same input.
 * Results are aggregated using the configured strategy:
 * first-wins, majority-vote, merge-all, or custom reducer.
 * Per-agent timeout with graceful degradation (failed agents are excluded).
 */

import type { AgentResponse } from "@openlinkos/agent";
import type {
  TeamResult,
  TeamHooks,
  AgentRole,
  AggregationStrategy,
} from "../types.js";
import { aggregateUsage } from "../utils.js";

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function firstWins(responses: AgentResponse[]): string {
  return responses[0]?.text ?? "";
}

function majorityVote(responses: AgentResponse[]): string {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const text = r.text.trim();
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }

  let bestText = "";
  let bestCount = 0;
  for (const [text, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestText = text;
    }
  }
  return bestText;
}

function mergeAll(responses: AgentResponse[]): string {
  return responses
    .map((r) => `[${r.agentName}]: ${r.text}`)
    .join("\n\n");
}

/**
 * Apply the aggregation strategy to produce a final output.
 */
export function aggregate(
  strategy: AggregationStrategy,
  responses: AgentResponse[],
  customReducer?: (responses: AgentResponse[]) => string,
): string {
  if (responses.length === 0) return "";

  switch (strategy) {
    case "first-wins":
      return firstWins(responses);
    case "majority-vote":
      return majorityVote(responses);
    case "merge-all":
      return mergeAll(responses);
    case "custom":
      if (!customReducer) {
        throw new Error(
          'Aggregation strategy "custom" requires a customReducer function.',
        );
      }
      return customReducer(responses);
  }
}

// ---------------------------------------------------------------------------
// Run a single agent with timeout
// ---------------------------------------------------------------------------

interface AgentOutcome {
  response: AgentResponse | null;
  error?: string;
  agentName: string;
}

async function runWithTimeout(
  agent: AgentRole,
  input: string,
  timeoutMs: number | undefined,
): Promise<AgentOutcome> {
  const agentName = agent.agent.name;

  if (!timeoutMs) {
    try {
      const response = await agent.agent.run(input);
      return { response, agentName };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { response: null, error: errorMsg, agentName };
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race<AgentResponse | "timeout">([
      agent.agent.run(input),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);

    if (response === "timeout") {
      return {
        response: null,
        error: `Agent "${agentName}" timed out after ${timeoutMs}ms`,
        agentName,
      };
    }
    return { response, agentName };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { response: null, error: errorMsg, agentName };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Run parallel coordination
// ---------------------------------------------------------------------------

/**
 * Run parallel coordination: all agents execute on the same input.
 */
export async function runParallel(
  agents: AgentRole[],
  input: string,
  _maxRounds: number,
  hooks: TeamHooks,
  aggregationStrategy: AggregationStrategy = "merge-all",
  customReducer?: (responses: AgentResponse[]) => string,
  agentTimeout?: number,
): Promise<TeamResult> {
  if (hooks.onRoundStart) {
    await hooks.onRoundStart(1);
  }

  // Notify agent starts
  for (const { agent } of agents) {
    if (hooks.onAgentStart) {
      await hooks.onAgentStart(agent.name, 1);
    }
  }

  // Run all agents in parallel
  const outcomes = await Promise.all(
    agents.map((a) => runWithTimeout(a, input, agentTimeout)),
  );

  // Collect successful results
  const agentResults: AgentResponse[] = [];
  for (const outcome of outcomes) {
    if (outcome.response) {
      agentResults.push(outcome.response);
      if (hooks.onAgentEnd) {
        await hooks.onAgentEnd(outcome.agentName, outcome.response, 1);
      }
    } else if (outcome.error && hooks.onError) {
      await hooks.onError(new Error(outcome.error));
    }
  }

  if (hooks.onRoundEnd) {
    await hooks.onRoundEnd(1, agentResults);
  }

  const finalOutput = aggregate(aggregationStrategy, agentResults, customReducer);

  return {
    finalOutput,
    agentResults,
    rounds: 1,
    totalUsage: aggregateUsage(agentResults),
  };
}
