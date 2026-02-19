/**
 * @openlinkos/team — Multi-agent collaboration layer.
 *
 * Orchestrate groups of agents using built-in collaboration patterns:
 * supervisor, swarm, pipeline, and debate. The primary differentiator
 * of the OpenLinkOS Agent Framework.
 *
 * @packageDocumentation
 */

import type { Agent, AgentResponse } from "@openlinkos/agent";

/**
 * Collaboration mode for the team.
 *
 * - `supervisor` — A lead agent delegates, reviews, and synthesizes.
 * - `swarm` — Agents self-organize and converge on solutions.
 * - `pipeline` — Sequential processing with each agent transforming data.
 * - `debate` — Agents argue perspectives; a judge resolves conflicts.
 */
export type TeamMode = "supervisor" | "swarm" | "pipeline" | "debate";

export interface TeamConfig {
  /** The collaboration mode. */
  mode: TeamMode;
  /** The agents participating in the team. */
  agents: Agent[];
  /** Maximum number of collaboration rounds. */
  maxRounds?: number;
}

export interface SupervisorConfig extends TeamConfig {
  mode: "supervisor";
  /** The agent that acts as the supervisor. If not set, the first agent is used. */
  supervisor?: Agent;
}

export interface SwarmConfig extends TeamConfig {
  mode: "swarm";
  /** Communication topology for the swarm. */
  topology?: "broadcast" | "peer-to-peer" | "ring";
}

export interface PipelineConfig extends TeamConfig {
  mode: "pipeline";
}

export interface DebateConfig extends TeamConfig {
  mode: "debate";
  /** The agent that judges the debate. If not set, a default judge is used. */
  judge?: Agent;
  /** Number of debate rounds before the judge rules. Defaults to 3. */
  rounds?: number;
}

export interface TeamResponse {
  /** The final synthesized text output from the team. */
  text: string;
  /** Individual responses from each agent during collaboration. */
  agentResponses: AgentResponse[];
  /** The collaboration mode used. */
  mode: TeamMode;
}

export interface Team {
  /** The collaboration mode. */
  readonly mode: TeamMode;
  /** Run the team on a given task. */
  run(task: string): Promise<TeamResponse>;
}

/**
 * Create a multi-agent team with a specified collaboration mode.
 *
 * @param config - Team configuration including mode, agents, and options.
 * @returns A Team instance ready to process tasks collaboratively.
 *
 * @example
 * ```typescript
 * import { createModel } from "@openlinkos/ai";
 * import { createAgent } from "@openlinkos/agent";
 * import { createTeam } from "@openlinkos/team";
 *
 * const model = createModel("openai:gpt-4o");
 *
 * const researcher = createAgent({
 *   name: "researcher",
 *   model,
 *   systemPrompt: "You research topics thoroughly.",
 * });
 *
 * const writer = createAgent({
 *   name: "writer",
 *   model,
 *   systemPrompt: "You write clear, engaging content.",
 * });
 *
 * const team = createTeam({
 *   mode: "pipeline",
 *   agents: [researcher, writer],
 * });
 *
 * const result = await team.run("Write an article about quantum computing.");
 * console.log(result.text);
 * ```
 */
export function createTeam(config: TeamConfig): Team {
  return {
    mode: config.mode,
    async run(_task: string): Promise<TeamResponse> {
      throw new Error(
        `Team mode "${config.mode}" is not yet implemented. This is a scaffold — multi-agent collaboration is coming in Phase 3.`
      );
    },
  };
}
