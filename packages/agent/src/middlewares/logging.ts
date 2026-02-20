/**
 * Logging middleware — logs all LLM calls, tool calls, and timing.
 */

import type { Middleware, NextFn, BeforeGenerateContext, AfterGenerateContext, BeforeToolCallContext, AfterToolCallContext, ErrorContext } from "../middleware.js";

/** Options for the logging middleware. */
export interface LoggingOptions {
  /** Custom logger function. Defaults to `console.log`. */
  logger?: (message: string) => void;
  /** Whether to include timing information. Default: true. */
  timing?: boolean;
  /** Optional prefix for all log messages. */
  prefix?: string;
}

/**
 * Create a logging middleware that records LLM calls, tool calls,
 * errors, and optionally timing information.
 */
export function createLoggingMiddleware(options: LoggingOptions = {}): Middleware {
  const {
    logger = console.log,
    timing = true,
    prefix = "[agent]",
  } = options;

  function log(msg: string): void {
    logger(`${prefix} ${msg}`);
  }

  const timers = new Map<string, number>();

  function startTimer(key: string): void {
    if (timing) {
      timers.set(key, Date.now());
    }
  }

  function endTimer(key: string): string {
    if (!timing) return "";
    const start = timers.get(key);
    timers.delete(key);
    if (start === undefined) return "";
    return ` (${Date.now() - start}ms)`;
  }

  return {
    name: "logging",

    async beforeGenerate(ctx: BeforeGenerateContext, next: NextFn): Promise<void> {
      log(`beforeGenerate: iteration=${ctx.iteration}, messages=${ctx.messages.length}, tools=${ctx.tools.length}`);
      startTimer(`generate-${ctx.iteration}`);
      await next();
    },

    async afterGenerate(ctx: AfterGenerateContext, next: NextFn): Promise<void> {
      const elapsed = endTimer(`generate-${ctx.iteration}`);
      const toolCallCount = ctx.response.toolCalls.length;
      const usage = ctx.response.usage;
      log(
        `afterGenerate: iteration=${ctx.iteration}, toolCalls=${toolCallCount}, ` +
        `tokens=${usage.totalTokens}${elapsed}`,
      );
      await next();
    },

    async beforeToolCall(ctx: BeforeToolCallContext, next: NextFn): Promise<void> {
      log(`beforeToolCall: ${ctx.toolCall.name} (id=${ctx.toolCall.id})`);
      startTimer(`tool-${ctx.toolCall.id}`);
      await next();
    },

    async afterToolCall(ctx: AfterToolCallContext, next: NextFn): Promise<void> {
      const elapsed = endTimer(`tool-${ctx.toolCall.id}`);
      if (ctx.error) {
        log(`afterToolCall: ${ctx.toolCall.name} ERROR: ${ctx.error}${elapsed}`);
      } else {
        const preview = ctx.result.length > 100
          ? ctx.result.slice(0, 100) + "..."
          : ctx.result;
        log(`afterToolCall: ${ctx.toolCall.name} OK: ${preview}${elapsed}`);
      }
      await next();
    },

    async onError(ctx: ErrorContext, next: NextFn): Promise<void> {
      log(`onError: ${ctx.error.message}`);
      await next();
    },
  };
}
