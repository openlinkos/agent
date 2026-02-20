/**
 * Tool-call scorer.
 *
 * Verifies that the agent's tool calls match an expected sequence/pattern.
 * Supports exact matching, partial matching, and order-sensitive matching.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { Scorer, ScorerResult } from "../types.js";

/** A tool call pattern to match against. */
export interface ToolCallPattern {
  /** Expected tool name. */
  name: string;
  /** Expected arguments (partial match). If omitted, arguments are not checked. */
  arguments?: Record<string, unknown>;
}

/** Options for the tool-call scorer. */
export interface ToolCallScorerOptions {
  /** Whether to require the tool calls in the specified order. Default: true. */
  ordered?: boolean;
  /** Whether to allow extra tool calls not in the expected pattern. Default: true. */
  allowExtra?: boolean;
}

/**
 * Check if actual arguments match expected arguments (partial match).
 */
function argumentsMatch(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Create a tool-call scorer from an expected pattern.
 *
 * The expected parameter is parsed as a JSON string or string array
 * representing tool call patterns.
 */
export function createToolCallScorer(
  expectedCalls: ToolCallPattern[],
  options?: ToolCallScorerOptions,
): Scorer {
  const ordered = options?.ordered ?? true;
  const allowExtra = options?.allowExtra ?? true;

  return {
    name: "tool-call",

    score(response: AgentResponse): ScorerResult {
      const actualCalls = response.toolCalls;

      if (expectedCalls.length === 0) {
        return {
          score: actualCalls.length === 0 ? 1.0 : 0.0,
          details: actualCalls.length === 0
            ? "No tool calls expected, none made."
            : `Expected no tool calls but got ${actualCalls.length}.`,
        };
      }

      // Check for extra tool calls
      if (!allowExtra && actualCalls.length > expectedCalls.length) {
        return {
          score: expectedCalls.length / actualCalls.length,
          details: `Expected ${expectedCalls.length} tool calls but got ${actualCalls.length} (extra calls not allowed).`,
        };
      }

      let matched = 0;
      const details: string[] = [];

      if (ordered) {
        // Match in order: walk through actual calls sequentially
        let actualIdx = 0;
        for (const pattern of expectedCalls) {
          let found = false;
          while (actualIdx < actualCalls.length) {
            const call = actualCalls[actualIdx];
            actualIdx++;
            if (call.name === pattern.name) {
              if (!pattern.arguments || argumentsMatch(call.arguments, pattern.arguments)) {
                found = true;
                matched++;
                break;
              }
            }
          }
          if (!found) {
            details.push(`Missing: ${pattern.name}`);
          }
        }
      } else {
        // Unordered: each pattern can match any remaining call
        const used = new Set<number>();
        for (const pattern of expectedCalls) {
          let found = false;
          for (let i = 0; i < actualCalls.length; i++) {
            if (used.has(i)) continue;
            const call = actualCalls[i];
            if (call.name === pattern.name) {
              if (!pattern.arguments || argumentsMatch(call.arguments, pattern.arguments)) {
                found = true;
                matched++;
                used.add(i);
                break;
              }
            }
          }
          if (!found) {
            details.push(`Missing: ${pattern.name}`);
          }
        }
      }

      const score = matched / expectedCalls.length;
      const summary =
        matched === expectedCalls.length
          ? `All ${expectedCalls.length} expected tool call(s) matched.`
          : `${matched}/${expectedCalls.length} tool calls matched. ${details.join("; ")}`;

      return { score, details: summary };
    },
  };
}
