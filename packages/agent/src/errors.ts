/**
 * Typed error hierarchy for @openlinkos/agent.
 *
 * Re-exports shared errors from @openlinkos/ai and defines
 * agent-specific error types.
 */

import { BaseError } from "@openlinkos/ai";

// Re-export errors that apply at the agent layer
export {
  BaseError,
  ToolExecutionError,
  GuardrailError,
} from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type AgentErrorCode =
  | "TOOL_ERROR"
  | "GUARDRAIL_ERROR"
  | "MAX_ITERATIONS";

// ---------------------------------------------------------------------------
// Max iterations error
// ---------------------------------------------------------------------------

/**
 * The agent exceeded its maximum number of iterations.
 */
export class MaxIterationsError extends BaseError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("MAX_ITERATIONS", message, options?.cause ? { cause: options.cause } : undefined);
  }
}
