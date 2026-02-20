/**
 * Rate limiting utilities for @openlinkos/ai.
 *
 * Provides token-bucket rate limiting, request queuing, per-session
 * token budgets, and a convenience factory for wrapping Model instances.
 */

import type { Message, ModelConfig, ModelResponse, ToolDefinition } from "./types.js";
import type { StreamResult } from "./stream.js";
import type { Model, ModelRequestOptions } from "./index.js";
import { RateLimitError, TimeoutError } from "./errors.js";

// ---------------------------------------------------------------------------
// Token bucket
// ---------------------------------------------------------------------------

/**
 * A token-bucket rate limiter.
 *
 * Tokens are refilled at a constant rate. Each `consume()` call removes
 * tokens from the bucket. When the bucket is empty, `consume()` returns
 * false and the caller should wait or queue the request.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  readonly maxTokens: number;
  readonly refillRate: number;
  readonly refillIntervalMs: number;

  constructor(options: {
    maxTokens: number;
    refillRate: number;
    refillIntervalMs: number;
  }) {
    this.maxTokens = options.maxTokens;
    this.refillRate = options.refillRate;
    this.refillIntervalMs = options.refillIntervalMs;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    if (elapsed >= this.refillIntervalMs) {
      const intervals = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + intervals * this.refillRate,
      );
      this.lastRefillTime += intervals * this.refillIntervalMs;
    }
  }

  /**
   * Try to consume one token.
   * Returns `true` if a token was available, `false` otherwise.
   */
  consume(count = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /** Current number of available tokens. */
  get available(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Estimated time in milliseconds until `count` tokens are available.
   * Returns 0 if tokens are already available.
   */
  waitTime(count = 1): number {
    this.refill();
    if (this.tokens >= count) return 0;
    const deficit = count - this.tokens;
    const intervalsNeeded = Math.ceil(deficit / this.refillRate);
    return intervalsNeeded * this.refillIntervalMs;
  }
}

// ---------------------------------------------------------------------------
// Token budget
// ---------------------------------------------------------------------------

/** Tracks cumulative token usage per session and rejects when exceeded. */
export class TokenBudget {
  readonly maxTokens: number;
  private used: number;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
    this.used = 0;
  }

  /** Record token usage. Throws RateLimitError if budget would be exceeded. */
  record(tokens: number): void {
    if (this.used + tokens > this.maxTokens) {
      throw new RateLimitError(
        `Token budget exceeded: ${this.used + tokens} > ${this.maxTokens}`,
      );
    }
    this.used += tokens;
  }

  /** Number of tokens consumed so far. */
  get consumed(): number {
    return this.used;
  }

  /** Number of tokens remaining in the budget. */
  get remaining(): number {
    return Math.max(0, this.maxTokens - this.used);
  }

  /** Reset the budget counter to zero. */
  reset(): void {
    this.used = 0;
  }
}

// ---------------------------------------------------------------------------
// Rate limiter (Model wrapper)
// ---------------------------------------------------------------------------

/** Configuration for the rate-limited model wrapper. */
export interface RateLimiterConfig {
  /** Maximum requests allowed in the bucket. */
  maxTokens: number;
  /** Number of tokens to refill per interval. */
  refillRate: number;
  /** Refill interval in milliseconds. */
  refillIntervalMs: number;
  /** Maximum time in milliseconds to wait for a token before timing out. 0 means wait indefinitely. */
  timeoutMs?: number;
  /** Optional token budget for the session. */
  tokenBudget?: TokenBudget;
}

/** Internal queue entry for waiting requests. */
interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
}

/**
 * Wraps a Model with token-bucket rate limiting and optional token budgeting.
 *
 * When the bucket is empty, requests are queued and processed as tokens
 * become available. If `timeoutMs` is set, queued requests will be rejected
 * with a TimeoutError after the specified duration.
 */
export class RateLimiter implements Model {
  readonly modelId: string;
  private readonly inner: Model;
  private readonly bucket: TokenBucket;
  private readonly queue: QueueEntry[];
  private readonly timeoutMs: number;
  private readonly budget: TokenBudget | undefined;
  private drainTimer: ReturnType<typeof setInterval> | null;

  constructor(model: Model, config: RateLimiterConfig) {
    this.inner = model;
    this.modelId = model.modelId;
    this.bucket = new TokenBucket({
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
      refillIntervalMs: config.refillIntervalMs,
    });
    this.queue = [];
    this.timeoutMs = config.timeoutMs ?? 0;
    this.budget = config.tokenBudget;
    this.drainTimer = null;
  }

  /** Try to acquire a token, or queue the request until one is available. */
  private acquire(): Promise<void> {
    if (this.bucket.consume()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject };
      this.queue.push(entry);

      // Set up timeout if configured
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (this.timeoutMs > 0) {
        timer = setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            reject(
              new TimeoutError(
                `Rate limiter timed out after ${this.timeoutMs}ms`,
              ),
            );
          }
        }, this.timeoutMs);
      }

      // Replace resolve to also clear the timeout
      const originalResolve = entry.resolve;
      entry.resolve = () => {
        if (timer !== null) clearTimeout(timer);
        originalResolve();
      };

      this.startDrain();
    });
  }

  /** Start the drain loop that processes queued requests as tokens refill. */
  private startDrain(): void {
    if (this.drainTimer !== null) return;
    this.drainTimer = setInterval(() => {
      this.processQueue();
    }, this.bucket.refillIntervalMs);
  }

  /** Process queued entries when tokens become available. */
  private processQueue(): void {
    while (this.queue.length > 0 && this.bucket.consume()) {
      const entry = this.queue.shift()!;
      entry.resolve();
    }
    if (this.queue.length === 0 && this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  /** Record usage against the budget (if configured). */
  private recordUsage(response: ModelResponse): void {
    if (this.budget) {
      this.budget.record(response.usage.totalTokens);
    }
  }

  async generate(
    messages: Message[],
    config?: Partial<ModelConfig>,
    options?: ModelRequestOptions,
  ): Promise<ModelResponse> {
    await this.acquire();
    const response = await this.inner.generate(messages, config, options);
    this.recordUsage(response);
    return response;
  }

  async stream(
    messages: Message[],
    config?: Partial<ModelConfig>,
    options?: ModelRequestOptions,
  ): Promise<StreamResult> {
    await this.acquire();
    return this.inner.stream(messages, config, options);
  }

  async generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    config?: Partial<ModelConfig>,
    options?: ModelRequestOptions,
  ): Promise<ModelResponse> {
    await this.acquire();
    const response = await this.inner.generateWithTools(messages, tools, config, options);
    this.recordUsage(response);
    return response;
  }

  /** Number of requests currently queued. */
  get queueSize(): number {
    return this.queue.length;
  }

  /** Access the underlying token bucket. */
  get tokenBucket(): TokenBucket {
    return this.bucket;
  }

  /** Dispose the drain timer. Call when the rate limiter is no longer needed. */
  dispose(): void {
    if (this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    // Reject all queued entries
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      entry.reject(new Error("Rate limiter disposed"));
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a rate-limited wrapper around a Model.
 *
 * @example
 * ```typescript
 * import { createModel, createRateLimitedModel, TokenBudget } from "@openlinkos/ai";
 *
 * const model = createModel("openai:gpt-4o");
 * const budget = new TokenBudget(100_000);
 * const limited = createRateLimitedModel(model, {
 *   maxTokens: 10,
 *   refillRate: 1,
 *   refillIntervalMs: 1000,
 *   timeoutMs: 30_000,
 *   tokenBudget: budget,
 * });
 * ```
 */
export function createRateLimitedModel(
  model: Model,
  config: RateLimiterConfig,
): RateLimiter {
  return new RateLimiter(model, config);
}
