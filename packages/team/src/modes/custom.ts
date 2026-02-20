/**
 * Custom coordination mode.
 *
 * The user provides a coordination function that receives the full
 * agent pool and a TeamContext with communication primitives.
 */

import type { TeamResult, TeamHooks, AgentRole, CustomCoordinationFn } from "../types.js";
import { Blackboard, MessageBus, createTeamContext } from "../communication.js";

/**
 * Run custom coordination using a user-provided function.
 */
export async function runCustom(
  agents: AgentRole[],
  input: string,
  _maxRounds: number,
  hooks: TeamHooks,
  coordinationFn: CustomCoordinationFn,
): Promise<TeamResult> {
  if (hooks.onRoundStart) {
    await hooks.onRoundStart(1);
  }

  const blackboard = new Blackboard();
  const messageBus = new MessageBus();
  const context = createTeamContext(blackboard, messageBus, 1, []);

  let result: TeamResult;
  try {
    result = await coordinationFn(agents, input, context);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (hooks.onError) {
      await hooks.onError(error);
    }
    throw error;
  }

  if (hooks.onRoundEnd) {
    await hooks.onRoundEnd(1, result.agentResults);
  }

  return result;
}
