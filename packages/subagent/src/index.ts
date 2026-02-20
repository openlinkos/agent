/**
 * @openlinkos/subagent — Sub-agent spawning, parallel execution, and nested delegation.
 *
 * Spawn child agents with scoped capabilities, run them in parallel,
 * and track progress with structured result reporting.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  SubAgentConfig,
  SubAgentResult,
  SpawnOptions,
  ProgressUpdate,
  ProgressCallback,
} from "./types.js";

// --- Sub-agent engine ---
export { spawnSubAgent, spawnParallel } from "./subagent.js";

// --- Progress & communication ---
export type { ResultSummary } from "./progress.js";
export {
  createProgressCollector,
  summarizeResult,
  summarizeResults,
} from "./progress.js";
