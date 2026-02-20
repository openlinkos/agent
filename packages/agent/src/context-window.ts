/**
 * Context window management for @openlinkos/agent.
 *
 * Provides token counting and sliding-window strategies to keep
 * conversation history within model context limits.
 */

import type { Message } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Token counter
// ---------------------------------------------------------------------------

/** Interface for estimating token counts from messages. */
export interface TokenCounter {
  /** Estimate the number of tokens in a single message. */
  countTokens(message: Message): number;
}

/**
 * Default character-based token estimator.
 *
 * Uses a simple heuristic of 1 token per 4 characters, which provides
 * a reasonable approximation for most English text.
 */
export class CharBasedTokenCounter implements TokenCounter {
  private readonly charsPerToken: number;

  constructor(charsPerToken = 4) {
    this.charsPerToken = charsPerToken;
  }

  countTokens(message: Message): number {
    let text: string;
    if (message.role === "assistant") {
      text = message.content ?? "";
      if (message.toolCalls && message.toolCalls.length > 0) {
        text += JSON.stringify(message.toolCalls);
      }
    } else {
      text = message.content;
    }
    return Math.ceil(text.length / this.charsPerToken);
  }
}

// ---------------------------------------------------------------------------
// Sliding window strategy
// ---------------------------------------------------------------------------

/** Options for the sliding window strategy. */
export interface SlidingWindowOptions {
  /** Maximum number of tokens allowed in the context window. */
  maxTokens: number;
  /** Token counter implementation. Defaults to CharBasedTokenCounter. */
  tokenCounter?: TokenCounter;
}

/**
 * Sliding window strategy that drops the oldest non-system messages
 * when the total token count exceeds the configured limit.
 *
 * System messages are always preserved. User/assistant/tool messages
 * are dropped from the front (oldest first) until the window fits.
 */
export class SlidingWindowStrategy {
  private readonly maxTokens: number;
  private readonly tokenCounter: TokenCounter;

  constructor(options: SlidingWindowOptions) {
    this.maxTokens = options.maxTokens;
    this.tokenCounter = options.tokenCounter ?? new CharBasedTokenCounter();
  }

  /**
   * Apply the sliding window to a list of messages.
   *
   * Returns a new array with the oldest non-system messages removed
   * as needed to fit within the token limit.
   */
  apply(messages: Message[]): Message[] {
    // Separate system messages from the rest
    const systemMessages: Message[] = [];
    const nonSystemMessages: Message[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemMessages.push(msg);
      } else {
        nonSystemMessages.push(msg);
      }
    }

    // Calculate system message tokens (always preserved)
    let systemTokens = 0;
    for (const msg of systemMessages) {
      systemTokens += this.tokenCounter.countTokens(msg);
    }

    // If system messages alone exceed the limit, return them as-is
    if (systemTokens >= this.maxTokens) {
      return [...systemMessages];
    }

    const availableTokens = this.maxTokens - systemTokens;

    // Calculate tokens for non-system messages from newest to oldest
    // and find the cutoff point
    const tokenCounts: number[] = nonSystemMessages.map((msg) =>
      this.tokenCounter.countTokens(msg),
    );

    let totalNonSystem = 0;
    for (const count of tokenCounts) {
      totalNonSystem += count;
    }

    // If everything fits, return as-is
    if (totalNonSystem <= availableTokens) {
      return [...messages];
    }

    // Drop from the front (oldest) until we fit
    let dropCount = 0;
    let droppedTokens = 0;
    while (
      dropCount < nonSystemMessages.length &&
      totalNonSystem - droppedTokens > availableTokens
    ) {
      droppedTokens += tokenCounts[dropCount];
      dropCount++;
    }

    const keptMessages = nonSystemMessages.slice(dropCount);
    return [...systemMessages, ...keptMessages];
  }

  /** Count total tokens in a list of messages. */
  countTotal(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.tokenCounter.countTokens(msg);
    }
    return total;
  }
}
