/**
 * Caching middleware — LRU cache for identical prompts.
 *
 * Caches model responses keyed by the full message array hash.
 * When a cache hit occurs, the cached response is injected into the
 * afterGenerate context, short-circuiting the actual LLM call.
 */

import type {
  Middleware,
  NextFn,
  BeforeGenerateContext,
  AfterGenerateContext,
} from "../middleware.js";
import type { Message, ModelResponse } from "@openlinkos/ai";

/** Options for the caching middleware. */
export interface CachingOptions {
  /** Maximum number of cached entries. Default: 100. */
  maxSize?: number;
}

/** A single cache entry with access metadata. */
interface CacheEntry {
  response: ModelResponse;
  lastAccessed: number;
}

/**
 * Create a caching middleware that stores model responses in an LRU cache.
 *
 * The cache key is derived from the full message array content. When the
 * same prompt sequence is seen again, the cached response is used and the
 * LLM call is skipped.
 */
export function createCachingMiddleware(options: CachingOptions = {}): Middleware & {
  /** Read-only access to current cache size. */
  readonly cacheSize: number;
  /** Clear the cache. */
  clearCache(): void;
} {
  const maxSize = options.maxSize ?? 100;
  const cache = new Map<string, CacheEntry>();

  // Pending cache hit to be applied in afterGenerate
  let pendingHit: ModelResponse | null = null;

  function computeKey(messages: Message[]): string {
    // Fast deterministic key from message contents
    const parts: string[] = [];
    for (const msg of messages) {
      parts.push(`${msg.role}:${msg.content ?? ""}`);
      if ("toolCalls" in msg && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push(`tc:${tc.name}:${JSON.stringify(tc.arguments)}`);
        }
      }
      if ("toolCallId" in msg && msg.toolCallId) {
        parts.push(`tid:${msg.toolCallId}`);
      }
    }
    return parts.join("|");
  }

  function evictIfNeeded(): void {
    if (cache.size <= maxSize) return;
    // Evict least-recently-accessed entry
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  const middleware: Middleware & {
    readonly cacheSize: number;
    clearCache(): void;
  } = {
    name: "caching",

    get cacheSize(): number {
      return cache.size;
    },

    clearCache(): void {
      cache.clear();
    },

    async beforeGenerate(ctx: BeforeGenerateContext, next: NextFn): Promise<void> {
      const key = computeKey(ctx.messages);
      const entry = cache.get(key);
      if (entry) {
        entry.lastAccessed = Date.now();
        pendingHit = entry.response;
      } else {
        pendingHit = null;
      }
      await next();
    },

    async afterGenerate(ctx: AfterGenerateContext, next: NextFn): Promise<void> {
      if (pendingHit) {
        // Apply cached response — overwrite the actual model response
        ctx.response.text = pendingHit.text;
        ctx.response.toolCalls = pendingHit.toolCalls;
        ctx.response.usage = pendingHit.usage;
        ctx.response.finishReason = pendingHit.finishReason;
        pendingHit = null;
      } else {
        // Store the response in cache
        const key = computeKey(ctx.messages);
        cache.set(key, {
          response: {
            text: ctx.response.text,
            toolCalls: [...ctx.response.toolCalls],
            usage: { ...ctx.response.usage },
            finishReason: ctx.response.finishReason,
          },
          lastAccessed: Date.now(),
        });
        evictIfNeeded();
      }
      await next();
    },
  };

  return middleware;
}
