/**
 * Cost-tracking middleware — tracks token usage and estimated cost.
 *
 * Accumulates token usage across all LLM calls in an agent run and
 * provides estimated costs based on configurable per-token pricing.
 */

import type {
  Middleware,
  NextFn,
  AfterGenerateContext,
} from "../middleware.js";

/** Per-token pricing configuration. */
export interface CostPricing {
  /** Cost per prompt (input) token. Default: 0. */
  promptTokenCost?: number;
  /** Cost per completion (output) token. Default: 0. */
  completionTokenCost?: number;
}

/** A snapshot of accumulated cost-tracking data. */
export interface CostSnapshot {
  /** Total prompt tokens across all calls. */
  totalPromptTokens: number;
  /** Total completion tokens across all calls. */
  totalCompletionTokens: number;
  /** Total tokens (prompt + completion). */
  totalTokens: number;
  /** Number of LLM calls tracked. */
  callCount: number;
  /** Estimated total cost based on pricing. */
  estimatedCost: number;
}

/**
 * Create a cost-tracking middleware.
 *
 * Use `getSnapshot()` to read accumulated stats and `reset()` to zero them.
 */
export function createCostTrackingMiddleware(pricing: CostPricing = {}): Middleware & {
  /** Get a snapshot of the current cost data. */
  getSnapshot(): CostSnapshot;
  /** Reset all counters to zero. */
  reset(): void;
} {
  const promptTokenCost = pricing.promptTokenCost ?? 0;
  const completionTokenCost = pricing.completionTokenCost ?? 0;

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let callCount = 0;

  const middleware: Middleware & {
    getSnapshot(): CostSnapshot;
    reset(): void;
  } = {
    name: "cost-tracking",

    getSnapshot(): CostSnapshot {
      const totalTokens = totalPromptTokens + totalCompletionTokens;
      const estimatedCost =
        totalPromptTokens * promptTokenCost +
        totalCompletionTokens * completionTokenCost;
      return {
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        callCount,
        estimatedCost,
      };
    },

    reset(): void {
      totalPromptTokens = 0;
      totalCompletionTokens = 0;
      callCount = 0;
    },

    async afterGenerate(ctx: AfterGenerateContext, next: NextFn): Promise<void> {
      const usage = ctx.response.usage;
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      callCount += 1;
      await next();
    },
  };

  return middleware;
}
