/**
 * Core types for @openlinkos/subagent.
 *
 * Defines sub-agent configuration, results, spawn options,
 * and progress reporting interfaces.
 */

import type { AgentConfig, AgentResponse } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Sub-agent configuration
// ---------------------------------------------------------------------------

/** Configuration for spawning a sub-agent. Extends AgentConfig with delegation settings. */
export interface SubAgentConfig extends AgentConfig {
  /** Timeout in milliseconds for sub-agent execution. Default: 60000. */
  timeoutMs?: number;
  /** Maximum context tokens to pass to the sub-agent. */
  maxContextTokens?: number;
  /** Strategy for inheriting context from the parent agent. */
  contextStrategy?: "full" | "summary" | "selective";
}

// ---------------------------------------------------------------------------
// Sub-agent result
// ---------------------------------------------------------------------------

/** Result from a sub-agent execution, including metadata. */
export interface SubAgentResult {
  /** The sub-agent's name. */
  agentName: string;
  /** The agent response from the sub-agent. */
  response: AgentResponse;
  /** Whether the sub-agent execution succeeded. */
  success: boolean;
  /** Error message if execution failed. */
  error?: string;
  /** Duration of execution in milliseconds. */
  durationMs: number;
  /** Token usage from the sub-agent run. */
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Number of reasoning steps the sub-agent took. */
  steps: number;
}

// ---------------------------------------------------------------------------
// Spawn options
// ---------------------------------------------------------------------------

/** Options for spawning sub-agents. */
export interface SpawnOptions {
  /** Timeout in milliseconds per sub-agent. Default: 60000. */
  timeout?: number;
  /** Maximum number of concurrent sub-agents for parallel execution. Default: 5. */
  maxConcurrent?: number;
  /** Context inheritance mode. */
  contextInheritance?: "none" | "system-prompt" | "full-history";
  /** Maximum depth for nested sub-agent spawning. Default: 3. */
  maxDepth?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** A progress update from a sub-agent. */
export interface ProgressUpdate {
  /** The sub-agent's name. */
  agentName: string;
  /** The type of progress event. */
  type: "started" | "step" | "tool_call" | "completed" | "failed";
  /** Human-readable message. */
  message: string;
  /** Timestamp of the event. */
  timestamp: number;
  /** Current step number, if applicable. */
  stepNumber?: number;
}

/** Callback for receiving progress updates. */
export type ProgressCallback = (update: ProgressUpdate) => void;
