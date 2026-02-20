/**
 * Sub-agent engine for @openlinkos/subagent.
 *
 * Provides spawning of sub-agents, parallel execution,
 * nested delegation with depth limits, and cancellation.
 */

import { createAgent } from "@openlinkos/agent";
import type { AgentResponse } from "@openlinkos/agent";
import type {
  SubAgentConfig,
  SubAgentResult,
  SpawnOptions,
  ProgressCallback,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResponse(agentName: string): AgentResponse {
  return {
    text: "",
    steps: [],
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    agentName,
  };
}

function makeResult(
  agentName: string,
  response: AgentResponse,
  durationMs: number,
  success: boolean,
  error?: string,
): SubAgentResult {
  return {
    agentName,
    response,
    success,
    error,
    durationMs,
    tokens: {
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
    },
    steps: response.steps.length,
  };
}

// ---------------------------------------------------------------------------
// Spawn a single sub-agent
// ---------------------------------------------------------------------------

/**
 * Spawn and run a single sub-agent with the given configuration and input.
 *
 * Supports timeout via AbortController and reports progress via callback.
 */
export async function spawnSubAgent(
  config: SubAgentConfig,
  input: string,
  options: SpawnOptions = {},
  onProgress?: ProgressCallback,
  currentDepth: number = 0,
): Promise<SubAgentResult> {
  const timeout = options.timeout ?? config.timeoutMs ?? 60_000;
  const maxDepth = options.maxDepth ?? 3;

  if (currentDepth >= maxDepth) {
    return makeResult(
      config.name,
      emptyResponse(config.name),
      0,
      false,
      `Maximum nesting depth of ${maxDepth} exceeded`,
    );
  }

  // Check if already cancelled
  if (options.signal?.aborted) {
    return makeResult(
      config.name,
      emptyResponse(config.name),
      0,
      false,
      "Cancelled before execution",
    );
  }

  onProgress?.({
    agentName: config.name,
    type: "started",
    message: `Sub-agent "${config.name}" started`,
    timestamp: Date.now(),
  });

  const agent = createAgent(config);
  const start = Date.now();

  // Set up abort/timeout handling
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Link parent signal
  const onAbort = () => abortController.abort();
  if (options.signal) {
    options.signal.addEventListener("abort", onAbort);
  }

  try {
    const raceResult = await Promise.race<AgentResponse | "timeout" | "cancelled">([
      agent.run(input),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeout);
      }),
      ...(options.signal
        ? [
            new Promise<"cancelled">((resolve) => {
              if (options.signal!.aborted) {
                resolve("cancelled");
              } else {
                options.signal!.addEventListener("abort", () => resolve("cancelled"));
              }
            }),
          ]
        : []),
    ]);

    const durationMs = Date.now() - start;

    if (raceResult === "timeout") {
      onProgress?.({
        agentName: config.name,
        type: "failed",
        message: `Sub-agent "${config.name}" timed out after ${timeout}ms`,
        timestamp: Date.now(),
      });
      return makeResult(
        config.name,
        emptyResponse(config.name),
        durationMs,
        false,
        `Sub-agent timed out after ${timeout}ms`,
      );
    }

    if (raceResult === "cancelled") {
      onProgress?.({
        agentName: config.name,
        type: "failed",
        message: `Sub-agent "${config.name}" was cancelled`,
        timestamp: Date.now(),
      });
      return makeResult(
        config.name,
        emptyResponse(config.name),
        durationMs,
        false,
        "Sub-agent was cancelled",
      );
    }

    onProgress?.({
      agentName: config.name,
      type: "completed",
      message: `Sub-agent "${config.name}" completed in ${durationMs}ms`,
      timestamp: Date.now(),
    });

    return makeResult(config.name, raceResult, durationMs, true);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    onProgress?.({
      agentName: config.name,
      type: "failed",
      message: `Sub-agent "${config.name}" failed: ${errorMsg}`,
      timestamp: Date.now(),
    });

    return makeResult(
      config.name,
      emptyResponse(config.name),
      durationMs,
      false,
      errorMsg,
    );
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener("abort", onAbort);
    }
  }
}

// ---------------------------------------------------------------------------
// Spawn multiple sub-agents in parallel
// ---------------------------------------------------------------------------

/**
 * Spawn multiple sub-agents in parallel with concurrency control.
 *
 * Uses Promise.allSettled so one failure doesn't block others.
 */
export async function spawnParallel(
  configs: SubAgentConfig[],
  inputs: string[],
  options: SpawnOptions = {},
  onProgress?: ProgressCallback,
): Promise<SubAgentResult[]> {
  if (configs.length !== inputs.length) {
    throw new Error(
      `configs and inputs must have the same length (got ${configs.length} configs, ${inputs.length} inputs)`,
    );
  }

  if (configs.length === 0) {
    return [];
  }

  const maxConcurrent = options.maxConcurrent ?? 5;

  // Process in batches respecting maxConcurrent
  const results: SubAgentResult[] = [];

  for (let i = 0; i < configs.length; i += maxConcurrent) {
    const batch = configs.slice(i, i + maxConcurrent);
    const batchInputs = inputs.slice(i, i + maxConcurrent);

    const settled = await Promise.allSettled(
      batch.map((config, idx) =>
        spawnSubAgent(config, batchInputs[idx], options, onProgress),
      ),
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Should not happen since spawnSubAgent catches errors,
        // but handle it defensively.
        const agentName = batch[j].name;
        results.push(
          makeResult(agentName, emptyResponse(agentName), 0, false, result.reason?.message ?? "Unknown error"),
        );
      }
    }
  }

  return results;
}
