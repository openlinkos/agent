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
  TeamRunOptions,
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
    tracer,
  } = config;

  if (rawAgents.length === 0) {
    throw new Error("A team requires at least one agent.");
  }

  const agents = normalizeAgents(rawAgents);

  return {
    name,
    coordinationMode,

    async run(input: string, runOptions?: TeamRunOptions): Promise<TeamResult> {
      const signal = runOptions?.signal;

      // --- Tracing: start trace for team run ---
      let traceId: string | undefined;
      let teamSpanId: string | undefined;
      if (tracer) {
        const trace = tracer.startTrace(`team:${name}`, {
          team: name,
          coordinationMode,
          input,
        });
        traceId = trace.id;
        const teamSpan = tracer.startSpan(traceId, "team-run", undefined, {
          team: name,
          coordinationMode,
        });
        teamSpanId = teamSpan.id;
      }

      // Wrap hooks to add tracing spans for rounds and agents
      const tracedHooks: TeamHooks = { ...hooks };
      const roundSpanIds = new Map<number, string>();
      const agentSpanIds = new Map<string, string>();

      if (tracer && traceId) {
        const _traceId = traceId;
        const _teamSpanId = teamSpanId;

        const origOnRoundStart = hooks.onRoundStart;
        tracedHooks.onRoundStart = async (round: number) => {
          const span = tracer.startSpan(_traceId, `round-${round}`, _teamSpanId, { round });
          roundSpanIds.set(round, span.id);
          if (origOnRoundStart) await origOnRoundStart(round);
        };

        const origOnAgentStart = hooks.onAgentStart;
        tracedHooks.onAgentStart = async (agentName: string, round: number) => {
          const parentId = roundSpanIds.get(round) ?? _teamSpanId;
          const span = tracer.startSpan(_traceId, `agent:${agentName}`, parentId, {
            agent: agentName,
            round,
          });
          agentSpanIds.set(`${round}:${agentName}`, span.id);
          if (origOnAgentStart) await origOnAgentStart(agentName, round);
        };

        const origOnAgentEnd = hooks.onAgentEnd;
        tracedHooks.onAgentEnd = async (agentName, response, round) => {
          const key = `${round}:${agentName}`;
          const spanId = agentSpanIds.get(key);
          if (spanId) {
            tracer.endSpan(_traceId, spanId, "ok", {
              responseLength: response.text.length,
              totalTokens: response.usage.totalTokens,
            });
            agentSpanIds.delete(key);
          }
          if (origOnAgentEnd) await origOnAgentEnd(agentName, response, round);
        };

        const origOnRoundEnd = hooks.onRoundEnd;
        tracedHooks.onRoundEnd = async (round, results) => {
          const spanId = roundSpanIds.get(round);
          if (spanId) {
            tracer.endSpan(_traceId, spanId, "ok", { agentCount: results.length });
            roundSpanIds.delete(round);
          }
          if (origOnRoundEnd) await origOnRoundEnd(round, results);
        };

        const origOnError = hooks.onError;
        tracedHooks.onError = async (error: Error) => {
          if (origOnError) await origOnError(error);
        };
      }

      try {
        let result: TeamResult;
        switch (coordinationMode) {
          case "sequential":
            result = await runSequential(agents, input, maxRounds, tracedHooks, signal);
            break;

          case "parallel": {
            const pc = config as ParallelConfig;
            result = await runParallel(
              agents,
              input,
              maxRounds,
              tracedHooks,
              pc.aggregationStrategy,
              pc.customReducer,
              pc.agentTimeout,
              signal,
            );
            break;
          }

          case "debate": {
            const dc = config as DebateConfig;
            result = await runDebate(agents, input, maxRounds, tracedHooks, dc.judge, dc.rounds, signal);
            break;
          }

          case "supervisor": {
            const sc = config as SupervisorConfig;
            result = await runSupervisor(agents, input, maxRounds, tracedHooks, sc.supervisor, signal);
            break;
          }

          case "custom": {
            const cc = config as CustomConfig;
            if (!cc.coordinationFn) {
              throw new Error(
                'Custom coordination mode requires a "coordinationFn" in the config.',
              );
            }
            result = await runCustom(agents, input, maxRounds, tracedHooks, cc.coordinationFn);
            break;
          }

          default:
            throw new Error(`Unknown coordination mode: "${coordinationMode}"`);
        }

        // --- Tracing: end trace on success ---
        if (tracer && traceId && teamSpanId) {
          tracer.endSpan(traceId, teamSpanId, "ok", {
            rounds: result.rounds,
            totalTokens: result.totalUsage.totalTokens,
          });
          await tracer.endTrace(traceId);
        }

        return result;
      } catch (err) {
        // --- Tracing: end trace on error ---
        if (tracer && traceId && teamSpanId) {
          tracer.endSpan(traceId, teamSpanId, "error", {
            error: err instanceof Error ? err.message : String(err),
          });
          await tracer.endTrace(traceId);
        }
        throw err;
      }
    },
  };
}
