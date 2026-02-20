/**
 * Team engine — the main factory and orchestrator.
 *
 * createTeam(config) creates a Team instance that dispatches to the
 * appropriate coordination mode implementation.
 */

import type {
  TeamConfig,
  Team,
  TeamResult,
  TeamHooks,
  ParallelConfig,
  DebateConfig,
  SupervisorConfig,
  CustomConfig,
} from "./types.js";
import { normalizeAgents } from "./utils.js";
import { runSequential } from "./modes/sequential.js";
import { runParallel } from "./modes/parallel.js";
import { runDebate } from "./modes/debate.js";
import { runSupervisor } from "./modes/supervisor.js";
import { runCustom } from "./modes/custom.js";

/** Default hooks object (all no-ops). */
const emptyHooks: TeamHooks = {};

/**
 * Create a multi-agent team with a specified coordination mode.
 *
 * @param config - Team configuration including mode, agents, and options.
 * @returns A Team instance ready to process tasks collaboratively.
 */
export function createTeam(config: TeamConfig): Team {
  const {
    name,
    agents: rawAgents,
    coordinationMode,
    maxRounds = 10,
    hooks = emptyHooks,
  } = config;

  if (rawAgents.length === 0) {
    throw new Error("A team requires at least one agent.");
  }

  const agents = normalizeAgents(rawAgents);

  return {
    name,
    coordinationMode,

    async run(input: string): Promise<TeamResult> {
      switch (coordinationMode) {
        case "sequential":
          return runSequential(agents, input, maxRounds, hooks);

        case "parallel": {
          const pc = config as ParallelConfig;
          return runParallel(
            agents,
            input,
            maxRounds,
            hooks,
            pc.aggregationStrategy,
            pc.customReducer,
            pc.agentTimeout,
          );
        }

        case "debate": {
          const dc = config as DebateConfig;
          return runDebate(agents, input, maxRounds, hooks, dc.judge, dc.rounds);
        }

        case "supervisor": {
          const sc = config as SupervisorConfig;
          return runSupervisor(agents, input, maxRounds, hooks, sc.supervisor);
        }

        case "custom": {
          const cc = config as CustomConfig;
          if (!cc.coordinationFn) {
            throw new Error(
              'Custom coordination mode requires a "coordinationFn" in the config.',
            );
          }
          return runCustom(agents, input, maxRounds, hooks, cc.coordinationFn);
        }

        default:
          throw new Error(`Unknown coordination mode: "${coordinationMode}"`);
      }
    },
  };
}
