/**
 * Retry and fallback utilities for @openlinkos/ai.
 *
 * Provides exponential-backoff retry, rate-limit handling,
 * and provider fallback chains.
 */

import type { Message, ModelResponse, ToolDefinition } from "./types.js";
import type { ModelProvider, ProviderRequestOptions } from "./provider.js";
import type { StreamResult } from "./stream.js";
import {
  RateLimitError,
  ProviderError,
  TimeoutError,
  AbortError,
  AuthenticationError,
  InvalidRequestError,
} from "./errors.js";

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (not counting the initial try). Default: 3. */
  maxRetries?: number;
  /** Initial delay in milliseconds. Default: 1000. */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds. Default: 30000. */
  maxDelayMs?: number;
  /** Multiplier applied to delay between retries. Default: 2. */
  backoffMultiplier?: number;
  /** Predicate to decide if an error is retryable. Default: retries on rate-limit and server errors. */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  isRetryable: defaultIsRetryable,
};

/**
 * Default retryable error predicate.
 * Retries on HTTP 429 (rate limit) and 5xx server errors.
 * Never retries on abort, auth, or invalid request errors.
 */
export function defaultIsRetryable(error: unknown): boolean {
  // Never retry aborts
  if (error instanceof AbortError) return false;
  // Never retry auth or invalid request errors
  if (error instanceof AuthenticationError) return false;
  if (error instanceof InvalidRequestError) return false;

  // Always retry rate limits
  if (error instanceof RateLimitError) return true;
  // Always retry timeouts
  if (error instanceof TimeoutError) return true;
  // Retry server errors (5xx)
  if (error instanceof ProviderError) {
    const status = error.statusCode;
    return status !== undefined && status >= 500 && status < 600;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("429")) return true;
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
    if (msg.includes("server error") || msg.includes("internal error")) return true;
    if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("econnrefused")) return true;

    // Check for status property on error
    const statusError = error as Error & { status?: number; statusCode?: number };
    const status = statusError.status ?? statusError.statusCode;
    if (typeof status === "number") {
      return status === 429 || (status >= 500 && status < 600);
    }
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute the delay for a given attempt, with jitter.
 */
function computeDelay(attempt: number, opts: Required<RetryOptions>): number {
  const base = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt);
  const capped = Math.min(base, opts.maxDelayMs);
  // Add jitter: ±25%
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, capped + jitter);
}

/**
 * Execute a function with exponential-backoff retry.
 * Respects `retryAfter` on RateLimitError when available.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === opts.maxRetries || !opts.isRetryable(error)) {
        throw error;
      }
      // If the error is a RateLimitError with retryAfter, use that
      let delay: number;
      if (error instanceof RateLimitError && error.retryAfter !== undefined && error.retryAfter > 0) {
        delay = error.retryAfter * 1000; // retryAfter is in seconds
      } else {
        delay = computeDelay(attempt, opts);
      }
      await sleep(delay);
    }
  }

  // Should be unreachable, but TypeScript needs it
  throw lastError;
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

export interface FallbackOptions {
  /** Optional retry options applied to each provider attempt. */
  retryOptions?: RetryOptions;
}

/**
 * A provider wrapper that tries a chain of providers in order,
 * falling back to the next one on failure.
 */
export class FallbackProvider implements ModelProvider {
  readonly name: string;
  private readonly chain: ModelProvider[];
  private readonly retryOpts: RetryOptions | undefined;

  constructor(providers: ModelProvider[], options?: FallbackOptions) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider requires at least one provider.");
    }
    this.chain = providers;
    this.name = `fallback(${providers.map((p) => p.name).join(",")})`;
    this.retryOpts = options?.retryOptions;
  }

  get capabilities() {
    // Return capabilities of the first provider as the primary
    return this.chain[0].capabilities;
  }

  async generate(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    return this.tryChain((provider) =>
      withRetry(() => provider.generate(messages, options), this.retryOpts),
    );
  }

  async stream(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<StreamResult> {
    return this.tryChain((provider) =>
      withRetry(() => provider.stream(messages, options), this.retryOpts),
    );
  }

  async generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    return this.tryChain((provider) =>
      withRetry(
        () => provider.generateWithTools(messages, tools, options),
        this.retryOpts,
      ),
    );
  }

  private async tryChain<T>(fn: (provider: ModelProvider) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const provider of this.chain) {
      try {
        return await fn(provider);
      } catch (error) {
        lastError = error;
        // Continue to next provider in chain
      }
    }
    throw lastError;
  }
}

/**
 * Create a fallback provider from a list of providers.
 */
export function createFallback(
  providers: ModelProvider[],
  options?: FallbackOptions,
): FallbackProvider {
  return new FallbackProvider(providers, options);
}
