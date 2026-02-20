/**
 * Core types for the @openlinkos/team package.
 *
 * Defines team configuration, coordination modes, results, hooks,
 * and agent role assignments for multi-agent collaboration.
 */

import type { Agent, AgentResponse, Usage } from "@openlinkos/agent";
import type { Tracer } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Coordination modes
// ---------------------------------------------------------------------------

/** Supported coordination modes for multi-agent teams. */
export type CoordinationMode =
  | "sequential"
  | "parallel"
  | "debate"
  | "supervisor"
  | "custom";

// ---------------------------------------------------------------------------
// Agent roles
// ---------------------------------------------------------------------------

/** An agent assigned to a team with a specific role. */
export interface AgentRole {
  /** The agent instance. */
  agent: Agent;
  /** The role this agent plays in the team. */
  role: string;
  /** Human-readable description of this agent's responsibility. */
  description?: string;
  /** Whether this agent can delegate tasks to other agents. */
  canDelegate?: boolean;
}

// ---------------------------------------------------------------------------
// Team hooks
// ---------------------------------------------------------------------------

/** Lifecycle hooks for observing and controlling team execution. */
export interface TeamHooks {
  /** Called at the start of each collaboration round. */
  onRoundStart?: (round: number) => void | Promise<void>;
  /** Called when an agent starts processing. */
  onAgentStart?: (agentName: string, round: number) => void | Promise<void>;
  /** Called when an agent finishes processing. */
  onAgentEnd?: (
    agentName: string,
    response: AgentResponse,
    round: number,
  ) => void | Promise<void>;
  /** Called at the end of each collaboration round. */
  onRoundEnd?: (round: number, results: AgentResponse[]) => void | Promise<void>;
  /** Called when agents reach consensus (debate mode). */
  onConsensus?: (round: number, output: string) => void | Promise<void>;
  /** Called when an error occurs during team execution. */
  onError?: (error: Error) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Team configuration
// ---------------------------------------------------------------------------

/** Base configuration for creating a team. */
export interface TeamConfig {
  /** Name of the team. */
  name: string;
  /** Agents participating in the team. Can be plain agents or role-assigned agents. */
  agents: Array<Agent | AgentRole>;
  /** The coordination mode to use. */
  coordinationMode: CoordinationMode;
  /** Maximum number of collaboration rounds. Default varies by mode. */
  maxRounds?: number;
  /** Lifecycle hooks for observability. */
  hooks?: TeamHooks;
  /** Tracer instance for observability tracing. */
  tracer?: Tracer;
}

// ---------------------------------------------------------------------------
// Mode-specific configuration
// ---------------------------------------------------------------------------

/** Configuration for sequential (pipeline) coordination. */
export interface SequentialConfig extends TeamConfig {
  coordinationMode: "sequential";
}

/** Aggregation strategy for parallel execution results. */
export type AggregationStrategy =
  | "first-wins"
  | "majority-vote"
  | "merge-all"
  | "custom";

/** Configuration for parallel coordination. */
export interface ParallelConfig extends TeamConfig {
  coordinationMode: "parallel";
  /** How to aggregate results from parallel agents. Default: "merge-all". */
  aggregationStrategy?: AggregationStrategy;
  /** Custom reducer function when aggregationStrategy is "custom". */
  customReducer?: (responses: AgentResponse[]) => string;
  /** Per-agent timeout in milliseconds. */
  agentTimeout?: number;
}

/** Configuration for debate coordination. */
export interface DebateConfig extends TeamConfig {
  coordinationMode: "debate";
  /** Optional judge agent to evaluate and pick a winner. */
  judge?: Agent;
  /** Number of debate rounds. Default: 3. */
  rounds?: number;
}

/** Configuration for supervisor coordination. */
export interface SupervisorConfig extends TeamConfig {
  coordinationMode: "supervisor";
  /** The supervisor agent. If not set, the first agent is the supervisor. */
  supervisor?: Agent;
}

/** Custom coordination function signature. */
export type CustomCoordinationFn = (
  agents: AgentRole[],
  input: string,
  context: TeamContext,
) => Promise<TeamResult>;

/** Configuration for custom coordination. */
export interface CustomConfig extends TeamConfig {
  coordinationMode: "custom";
  /** The custom coordination function. */
  coordinationFn: CustomCoordinationFn;
}

// ---------------------------------------------------------------------------
// Team context (shared blackboard)
// ---------------------------------------------------------------------------

/** Shared context available to all agents during collaboration. */
export interface TeamContext {
  /** Key-value blackboard for inter-agent communication. */
  blackboard: Map<string, unknown>;
  /** The current round number (1-indexed). */
  currentRound: number;
  /** Results from previous rounds. */
  previousResults: AgentResponse[];
  /** Send a message to a specific agent via the message bus. */
  sendMessage: (from: string, to: string, content: string) => void;
  /** Get messages for a specific agent. */
  getMessages: (agentName: string) => TeamMessage[];
}

/** A message passed between agents. */
export interface TeamMessage {
  /** Sender agent name. */
  from: string;
  /** Recipient agent name. */
  to: string;
  /** Message content. */
  content: string;
  /** Timestamp. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Team result
// ---------------------------------------------------------------------------

/** Result from a team execution. */
export interface TeamResult {
  /** The final synthesized output from the team. */
  finalOutput: string;
  /** Individual results from each agent. */
  agentResults: AgentResponse[];
  /** Number of collaboration rounds completed. */
  rounds: number;
  /** Aggregated usage across all agents and rounds. */
  totalUsage: Usage;
}

// ---------------------------------------------------------------------------
// Team run options
// ---------------------------------------------------------------------------

/** Options for a single team run. */
export interface TeamRunOptions {
  /** AbortSignal to cancel the team run. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Team interface
// ---------------------------------------------------------------------------

/** A configured team ready to execute collaborative tasks. */
export interface Team {
  /** The team's name. */
  readonly name: string;
  /** The coordination mode. */
  readonly coordinationMode: CoordinationMode;
  /** Run the team on a given input task. */
  run(input: string, options?: TeamRunOptions): Promise<TeamResult>;
}
