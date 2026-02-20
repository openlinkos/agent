/**
 * @openlinkos/team — Multi-agent collaboration engine.
 *
 * Orchestrate groups of agents using built-in coordination patterns:
 * sequential, parallel, debate, supervisor, and custom.
 * The primary differentiator of the OpenLinkOS Agent Framework.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  CoordinationMode,
  AgentRole,
  TeamHooks,
  TeamConfig,
  SequentialConfig,
  AggregationStrategy,
  ParallelConfig,
  DebateConfig,
  SupervisorConfig,
  CustomCoordinationFn,
  CustomConfig,
  TeamContext,
  TeamMessage,
  TeamResult,
  TeamRunOptions,
  Team,
} from "./types.js";

// --- Communication primitives ---
export {
  MessageBus,
  Blackboard,
  createHandoff,
  formatHandoffInput,
  createTeamContext,
} from "./communication.js";
export type { Handoff } from "./communication.js";

// --- Coordination mode implementations ---
export { runSequential } from "./modes/sequential.js";
export { runParallel, aggregate } from "./modes/parallel.js";
export { runDebate } from "./modes/debate.js";
export { runSupervisor } from "./modes/supervisor.js";
export { runCustom } from "./modes/custom.js";

// --- Utilities ---
export { normalizeAgents, emptyUsage, addUsage, aggregateUsage } from "./utils.js";

// --- Team factory ---
export { createTeam } from "./team.js";
