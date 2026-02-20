/**
 * Core types for the @openlinkos/eval package.
 *
 * Defines evaluation cases, results, scorers, suites, and reports
 * for systematic agent evaluation.
 */

import type { AgentResponse } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Eval case
// ---------------------------------------------------------------------------

/** A single evaluation test case. */
export interface EvalCase {
  /** The input prompt to send to the agent. */
  input: string;
  /** The expected output or pattern to match against. */
  expected: string | string[];
  /** Optional metadata for categorization and reporting. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Eval result
// ---------------------------------------------------------------------------

/** The result of evaluating a single case. */
export interface EvalResult {
  /** The eval case that was run. */
  case: EvalCase;
  /** The agent's actual response. */
  response: AgentResponse;
  /** Score between 0 and 1. */
  score: number;
  /** Whether this case passed (score >= threshold). */
  passed: boolean;
  /** Human-readable details about the scoring. */
  details: string;
  /** Duration in milliseconds. */
  duration: number;
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

/**
 * A scorer evaluates an agent response against the expected output.
 * Returns a score between 0 and 1, plus optional detail text.
 */
export interface Scorer {
  /** A name for this scorer. */
  readonly name: string;

  /** Score the response against the expected value. */
  score(
    response: AgentResponse,
    expected: string | string[],
  ): ScorerResult | Promise<ScorerResult>;
}

/** Result from a scorer. */
export interface ScorerResult {
  /** Score between 0.0 and 1.0. */
  score: number;
  /** Human-readable explanation of the score. */
  details: string;
}

// ---------------------------------------------------------------------------
// Eval suite
// ---------------------------------------------------------------------------

/** A named collection of eval cases with a scorer and pass threshold. */
export interface EvalSuite {
  /** Name of the suite. */
  name: string;
  /** The eval cases in this suite. */
  cases: EvalCase[];
  /** The scorer to use for this suite. */
  scorer: Scorer;
  /** Minimum score for a case to pass. Default: 1.0 (exact pass). */
  threshold?: number;
}

// ---------------------------------------------------------------------------
// Eval report
// ---------------------------------------------------------------------------

/** Summary statistics for an eval suite run. */
export interface EvalSummary {
  /** Total number of cases. */
  total: number;
  /** Number of cases that passed. */
  passed: number;
  /** Number of cases that failed. */
  failed: number;
  /** Average score across all cases. */
  averageScore: number;
  /** Total duration in milliseconds. */
  totalDuration: number;
  /** Pass rate as a fraction (0–1). */
  passRate: number;
}

/** A complete report for a suite evaluation. */
export interface EvalReport {
  /** The suite that was evaluated. */
  suite: EvalSuite;
  /** Individual results for each case. */
  results: EvalResult[];
  /** Summary statistics. */
  summary: EvalSummary;
  /** ISO timestamp of when the eval started. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Runner options
// ---------------------------------------------------------------------------

/** Options for running evaluations. */
export interface EvalRunOptions {
  /** Maximum number of cases to run concurrently. Default: 5. */
  concurrency?: number;
  /** Timeout per case in milliseconds. Default: 30000. */
  timeout?: number;
  /** Custom pass threshold override (overrides suite threshold). */
  threshold?: number;
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

/** A reporter formats and outputs eval results. */
export interface Reporter {
  /** Report results for a single suite. */
  report(report: EvalReport): void | Promise<void>;
  /** Report results for multiple suites. */
  reportAll?(reports: EvalReport[]): void | Promise<void>;
}
