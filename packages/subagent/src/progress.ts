/**
 * Progress and communication for @openlinkos/subagent.
 *
 * Provides structured result protocol and progress tracking
 * for sub-agent execution.
 */

import type { ProgressCallback, ProgressUpdate, SubAgentResult } from "./types.js";

// ---------------------------------------------------------------------------
// Progress collector
// ---------------------------------------------------------------------------

/**
 * Create a progress collector that accumulates progress updates
 * and optionally forwards them to a callback.
 */
export function createProgressCollector(
  forward?: ProgressCallback,
): {
  callback: ProgressCallback;
  getUpdates: () => ProgressUpdate[];
} {
  const updates: ProgressUpdate[] = [];

  return {
    callback: (update: ProgressUpdate) => {
      updates.push(update);
      forward?.(update);
    },
    getUpdates: () => [...updates],
  };
}

// ---------------------------------------------------------------------------
// Structured result protocol
// ---------------------------------------------------------------------------

/** Summary of a sub-agent result for reporting. */
export interface ResultSummary {
  agentName: string;
  status: "success" | "failure" | "partial";
  text: string;
  durationMs: number;
  totalTokens: number;
  steps: number;
  error?: string;
}

/**
 * Summarize a sub-agent result into a structured summary.
 */
export function summarizeResult(result: SubAgentResult): ResultSummary {
  const status = result.success
    ? "success"
    : result.response.steps.length > 0
      ? "partial"
      : "failure";

  return {
    agentName: result.agentName,
    status,
    text: result.response.text,
    durationMs: result.durationMs,
    totalTokens: result.tokens.totalTokens,
    steps: result.steps,
    error: result.error,
  };
}

/**
 * Summarize multiple sub-agent results.
 */
export function summarizeResults(results: SubAgentResult[]): ResultSummary[] {
  return results.map(summarizeResult);
}
