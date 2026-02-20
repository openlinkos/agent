/**
 * Middleware system for @openlinkos/agent.
 *
 * Middleware intercepts agent lifecycle events using an onion-model execution
 * order (first-in, outermost). Each middleware can inspect/modify context,
 * pass through to the next middleware via `next()`, or short-circuit by
 * returning early without calling `next()`.
 */

import type { Message, ModelResponse, ToolCall } from "@openlinkos/ai";
import type { ToolDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Context objects passed to middleware hooks
// ---------------------------------------------------------------------------

/** Context available to the beforeGenerate middleware hook. */
export interface BeforeGenerateContext {
  /** Current conversation messages (mutable — middleware may modify). */
  messages: Message[];
  /** Tools available for this generation. */
  tools: ToolDefinition[];
  /** The current iteration number (0-indexed). */
  iteration: number;
}

/** Context available to the afterGenerate middleware hook. */
export interface AfterGenerateContext {
  /** The model response (mutable — middleware may modify). */
  response: ModelResponse;
  /** Current conversation messages at the time of generation. */
  messages: Message[];
  /** The current iteration number (0-indexed). */
  iteration: number;
}

/** Context available to the beforeToolCall middleware hook. */
export interface BeforeToolCallContext {
  /** The tool call about to be executed. */
  toolCall: ToolCall;
  /** The tool definition (if found in registry). */
  tool?: ToolDefinition;
  /**
   * Set to `true` inside middleware to skip execution of this tool call.
   * The `result` field will be used as the tool response.
   */
  skip: boolean;
  /** When `skip` is true, this value is used as the tool result. */
  result?: string;
}

/** Context available to the afterToolCall middleware hook. */
export interface AfterToolCallContext {
  /** The tool call that was executed. */
  toolCall: ToolCall;
  /** The tool result string. */
  result: string;
  /** Error message, if the tool failed. */
  error?: string;
}

/** Context available to the onError middleware hook. */
export interface ErrorContext {
  /** The error that occurred. */
  error: Error;
  /** Whether the error has been handled (set to true to suppress rethrowing). */
  handled: boolean;
}

// ---------------------------------------------------------------------------
// Middleware interface
// ---------------------------------------------------------------------------

/** A function that invokes the next middleware in the stack. */
export type NextFn = () => Promise<void>;

/**
 * A middleware that can intercept agent lifecycle events.
 *
 * All hooks are optional. Each receives a context object and a `next`
 * function. Call `next()` to proceed to the next middleware (or the
 * core operation). Omit the call to short-circuit.
 */
export interface Middleware {
  /** Optional name for debugging / logging. */
  name?: string;

  /** Called before each LLM generation. */
  beforeGenerate?: (ctx: BeforeGenerateContext, next: NextFn) => Promise<void>;

  /** Called after each LLM generation. */
  afterGenerate?: (ctx: AfterGenerateContext, next: NextFn) => Promise<void>;

  /** Called before each tool call execution. */
  beforeToolCall?: (ctx: BeforeToolCallContext, next: NextFn) => Promise<void>;

  /** Called after each tool call execution. */
  afterToolCall?: (ctx: AfterToolCallContext, next: NextFn) => Promise<void>;

  /** Called when an error occurs during the agent run. */
  onError?: (ctx: ErrorContext, next: NextFn) => Promise<void>;
}

// ---------------------------------------------------------------------------
// MiddlewareStack
// ---------------------------------------------------------------------------

/**
 * Manages an ordered list of middleware and executes them in onion-model
 * order for each lifecycle hook.
 *
 * The first middleware added via `use()` is the outermost layer — it runs
 * first on the way in and last on the way out.
 */
export class MiddlewareStack {
  private readonly middlewares: Middleware[] = [];

  /** Add a middleware to the stack. */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /** Return all registered middlewares (read-only snapshot). */
  all(): readonly Middleware[] {
    return [...this.middlewares];
  }

  /** Number of middlewares in the stack. */
  get size(): number {
    return this.middlewares.length;
  }

  /**
   * Execute the `beforeGenerate` hook through the middleware stack.
   */
  async executeBeforeGenerate(ctx: BeforeGenerateContext): Promise<void> {
    await this.run("beforeGenerate", ctx);
  }

  /**
   * Execute the `afterGenerate` hook through the middleware stack.
   */
  async executeAfterGenerate(ctx: AfterGenerateContext): Promise<void> {
    await this.run("afterGenerate", ctx);
  }

  /**
   * Execute the `beforeToolCall` hook through the middleware stack.
   */
  async executeBeforeToolCall(ctx: BeforeToolCallContext): Promise<void> {
    await this.run("beforeToolCall", ctx);
  }

  /**
   * Execute the `afterToolCall` hook through the middleware stack.
   */
  async executeAfterToolCall(ctx: AfterToolCallContext): Promise<void> {
    await this.run("afterToolCall", ctx);
  }

  /**
   * Execute the `onError` hook through the middleware stack.
   */
  async executeOnError(ctx: ErrorContext): Promise<void> {
    await this.run("onError", ctx);
  }

  // -------------------------------------------------------------------------
  // Internal onion execution
  // -------------------------------------------------------------------------

  /**
   * Generic runner: composes middleware handlers in onion order.
   *
   * The outermost middleware (index 0) runs first. When it calls `next()`,
   * the next middleware runs, and so on. If any middleware does not call
   * `next()`, the remaining middlewares (and the core no-op) are skipped.
   */
  private async run(
    hook: string,
    ctx: unknown,
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      while (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        const fn = (mw as Record<string, unknown>)[hook] as
          | ((c: unknown, n: NextFn) => Promise<void>)
          | undefined;
        if (fn) {
          await fn.call(mw, ctx, next);
          return;
        }
        // This middleware has no handler for this hook — skip to next
      }
      // All middlewares exhausted — core no-op (the actual operation
      // happens outside of this stack).
    };

    await next();
  }
}
