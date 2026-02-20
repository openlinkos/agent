/**
 * Short-term conversation memory — rolling buffer of recent messages.
 *
 * Supports configurable max-messages and max-characters limits.
 * When either limit is exceeded the oldest messages are dropped.
 */

import type { ConversationMemory, ConversationMemoryConfig, ConversationMessage } from "./types.js";

/** Default configuration values. */
const DEFAULTS = {
  maxMessages: 50,
  maxChars: 100_000,
} as const;

/**
 * Create a short-term conversation memory buffer.
 *
 * @param config - Optional limits for the buffer.
 * @returns A {@link ConversationMemory} instance.
 *
 * @example
 * ```typescript
 * import { createConversationMemory } from "@openlinkos/plugin-memory";
 *
 * const memory = createConversationMemory({ maxMessages: 20 });
 * memory.add({ role: "user", content: "Hello" });
 * memory.add({ role: "assistant", content: "Hi there!" });
 * console.log(memory.getMessages()); // [{ role: "user", … }, { role: "assistant", … }]
 * ```
 */
export function createConversationMemory(
  config: ConversationMemoryConfig = {},
): ConversationMemory {
  const maxMessages = config.maxMessages ?? DEFAULTS.maxMessages;
  const maxChars = config.maxChars ?? DEFAULTS.maxChars;

  let messages: ConversationMessage[] = [];

  function totalChars(): number {
    let total = 0;
    for (const m of messages) {
      total += m.content.length;
    }
    return total;
  }

  function trim(): void {
    // Trim by message count first
    while (messages.length > maxMessages) {
      messages.shift();
    }
    // Then trim by total character length
    while (messages.length > 0 && totalChars() > maxChars) {
      messages.shift();
    }
  }

  return {
    add(message: ConversationMessage): void {
      messages.push(message);
      trim();
    },

    getMessages(): ConversationMessage[] {
      return [...messages];
    },

    clear(): void {
      messages = [];
    },

    get length(): number {
      return messages.length;
    },
  };
}
