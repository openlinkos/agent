/**
 * Includes scorer.
 *
 * Checks if the agent response contains expected keywords or substrings.
 * Returns a partial score based on how many keywords are present.
 */

import type { AgentResponse } from "@openlinkos/agent";
import type { Scorer, ScorerResult } from "../types.js";

/** Options for the includes scorer. */
export interface IncludesOptions {
  /** Case-insensitive matching. Default: true. */
  ignoreCase?: boolean;
  /** Require all keywords (true) or any keyword (false). Default: true. */
  requireAll?: boolean;
}

/**
 * Create an includes scorer.
 *
 * When expected is a single string, checks if the response contains it.
 * When expected is an array, checks for each keyword and returns a
 * proportional score (matched / total).
 */
export function createIncludesScorer(options?: IncludesOptions): Scorer {
  const ignoreCase = options?.ignoreCase ?? true;
  const requireAll = options?.requireAll ?? true;

  return {
    name: "includes",

    score(response: AgentResponse, expected: string | string[]): ScorerResult {
      const actual = ignoreCase ? (response.text ?? "").toLowerCase() : (response.text ?? "");
      const keywords = Array.isArray(expected) ? expected : [expected];

      const results = keywords.map((kw) => {
        const needle = ignoreCase ? kw.toLowerCase() : kw;
        return { keyword: kw, found: actual.includes(needle) };
      });

      const matchCount = results.filter((r) => r.found).length;
      const total = keywords.length;

      let score: number;
      if (requireAll) {
        score = matchCount === total ? 1.0 : matchCount / total;
      } else {
        score = matchCount > 0 ? 1.0 : 0.0;
      }

      const missing = results.filter((r) => !r.found).map((r) => r.keyword);
      const details = missing.length === 0
        ? `All ${total} keyword(s) found.`
        : `Missing ${missing.length}/${total}: ${missing.map((k) => `"${k}"`).join(", ")}.`;

      return { score, details };
    },
  };
}
