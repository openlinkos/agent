/**
 * Exact match scorer.
 *
 * Checks if the agent response exactly matches the expected string,
 * with optional normalization (trimming, case-insensitive, whitespace collapse).
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { Scorer, ScorerResult } from "../types.js";

/** Options for exact match normalization. */
export interface ExactMatchOptions {
  /** Trim whitespace from both ends. Default: true. */
  trim?: boolean;
  /** Compare in a case-insensitive manner. Default: false. */
  ignoreCase?: boolean;
  /** Collapse multiple whitespace characters to a single space. Default: false. */
  collapseWhitespace?: boolean;
}

/**
 * Normalize a string according to options.
 */
function normalize(s: string, opts: Required<ExactMatchOptions>): string {
  let result = s;
  if (opts.trim) result = result.trim();
  if (opts.collapseWhitespace) result = result.replace(/\s+/g, " ");
  if (opts.ignoreCase) result = result.toLowerCase();
  return result;
}

/**
 * Create an exact-match scorer.
 *
 * Returns score 1.0 for exact match, 0.0 otherwise.
 * When expected is an array, passes if the response matches any entry.
 */
export function createExactMatchScorer(options?: ExactMatchOptions): Scorer {
  const opts: Required<ExactMatchOptions> = {
    trim: options?.trim ?? true,
    ignoreCase: options?.ignoreCase ?? false,
    collapseWhitespace: options?.collapseWhitespace ?? false,
  };

  return {
    name: "exact-match",

    score(response: AgentResponse, expected: string | string[]): ScorerResult {
      const actual = normalize(response.text ?? "", opts);
      const expectedValues = Array.isArray(expected) ? expected : [expected];
      const normalizedExpected = expectedValues.map((e) => normalize(e, opts));

      const match = normalizedExpected.some((e) => actual === e);

      return {
        score: match ? 1.0 : 0.0,
        details: match
          ? "Exact match."
          : `Expected one of [${normalizedExpected.map((e) => `"${e}"`).join(", ")}], got "${actual}".`,
      };
    },
  };
}
