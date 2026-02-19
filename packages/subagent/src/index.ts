/**
 * @openlinkos/subagent — Sub-agent management.
 *
 * Spawn child agents with scoped capabilities, manage context windows,
 * and orchestrate delegation and handoff strategies.
 *
 * @packageDocumentation
 */

import type { Agent, AgentConfig, AgentResponse } from "@openlinkos/agent";

export interface SubAgentConfig extends AgentConfig {
  /** Maximum context tokens to pass to the sub-agent. */
  maxContextTokens?: number;
  /** Timeout in milliseconds for sub-agent execution. */
  timeoutMs?: number;
  /** Strategy for summarizing context before handoff. */
  contextStrategy?: "full" | "summary" | "selective";
}

export interface DelegationResult {
  /** The sub-agent that produced the result. */
  agentName: string;
  /** The sub-agent's response. */
  response: AgentResponse;
  /** Whether the delegation succeeded. */
  success: boolean;
  /** Error message if the delegation failed. */
  error?: string;
}

export interface SubAgentManager {
  /** Spawn a new sub-agent with the given configuration. */
  spawn(config: SubAgentConfig): Agent;
  /** Delegate a task to a specific sub-agent. */
  delegate(agent: Agent, task: string): Promise<DelegationResult>;
  /** Delegate a task to multiple sub-agents in parallel. */
  delegateAll(agents: Agent[], task: string): Promise<DelegationResult[]>;
}

/**
 * Create a sub-agent manager for spawning and delegating to child agents.
 *
 * @returns A SubAgentManager instance.
 *
 * @example
 * ```typescript
 * import { createSubAgentManager } from "@openlinkos/subagent";
 * import { createAgent } from "@openlinkos/agent";
 * import { createModel } from "@openlinkos/ai";
 *
 * const manager = createSubAgentManager();
 * const model = createModel("openai:gpt-4o");
 *
 * const researcher = manager.spawn({
 *   name: "researcher",
 *   model,
 *   systemPrompt: "You research topics thoroughly.",
 *   maxContextTokens: 4000,
 * });
 *
 * const result = await manager.delegate(researcher, "Research TypeScript 5.0 features");
 * console.log(result.response.text);
 * ```
 */
export function createSubAgentManager(): SubAgentManager {
  throw new Error(
    "SubAgentManager is not yet implemented. This is a scaffold — sub-agent management is coming in Phase 2."
  );
}
