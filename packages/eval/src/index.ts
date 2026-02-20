/**
 * @openlinkos/eval — Agent evaluation framework.
 *
 * Provides scorers, reporters, built-in eval suites, and a runner
 * for systematically evaluating AI agent quality.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  EvalCase,
  EvalResult,
  Scorer,
  ScorerResult,
  EvalSuite,
  EvalSummary,
  EvalReport,
  EvalRunOptions,
  Reporter,
} from "./types.js";

// --- Runner ---
export { runEval, runEvalSuite } from "./runner.js";

// --- Scorers ---
export { createExactMatchScorer } from "./scorers/exact.js";
export type { ExactMatchOptions } from "./scorers/exact.js";
export { createIncludesScorer } from "./scorers/includes.js";
export type { IncludesOptions } from "./scorers/includes.js";
export { createToolCallScorer } from "./scorers/tool-call.js";
export type { ToolCallPattern, ToolCallScorerOptions } from "./scorers/tool-call.js";
export { createLLMJudgeScorer } from "./scorers/llm-judge.js";
export type { LLMJudgeConfig } from "./scorers/llm-judge.js";

// --- Reporters ---
export { createConsoleReporter } from "./reporters/console.js";
export { createJSONReporter } from "./reporters/json.js";
export type { JSONReportOutput, JSONReporterOptions } from "./reporters/json.js";

// --- Built-in suites ---
export { createBasicQASuite } from "./suites/basic-qa.js";
export { createToolUseSuite, getExpectedCalls } from "./suites/tool-use.js";
export { createMultiTurnSuite } from "./suites/multi-turn.js";
