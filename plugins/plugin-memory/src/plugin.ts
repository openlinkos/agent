/**
 * Agent plugin integration — hooks memory into the agent lifecycle.
 *
 * Provides `onStart` (beforeRun) and `onEnd` (afterRun) hooks that
 * automatically load relevant memories before generation and save
 * important interactions afterward.
 */

import type { AgentHooks, AgentResponse } from "@openlinkos/agent";
import type {
  MemoryPlugin,
  MemoryPluginConfig,
  ConversationMemory,
  PersistentMemory,
  VectorMemory,
} from "./types.js";
import { createConversationMemory } from "./conversation.js";
import { createPersistentMemory } from "./persistent.js";
import { createVectorMemory } from "./vector.js";

/**
 * Create a memory plugin that integrates with the agent lifecycle.
 *
 * The returned object exposes the three memory sub-systems and an `AgentHooks`
 * object you can spread into your agent config.
 *
 * @param config - Plugin configuration.
 * @returns A {@link MemoryPlugin} instance.
 *
 * @example
 * ```typescript
 * import { createMemoryPlugin } from "@openlinkos/plugin-memory";
 * import { createAgent } from "@openlinkos/agent";
 *
 * const memory = createMemoryPlugin({
 *   conversation: { maxMessages: 30 },
 *   persistent: { filePath: "./data/memory.json" },
 * });
 *
 * const agent = createAgent({
 *   name: "assistant",
 *   model,
 *   systemPrompt: "You are helpful.",
 *   hooks: memory.hooks,
 * });
 * ```
 */
export function createMemoryPlugin(config: MemoryPluginConfig = {}): MemoryPlugin {
  const conversation: ConversationMemory = createConversationMemory(config.conversation);
  const persistent: PersistentMemory = createPersistentMemory(config.persistent);
  const vector: VectorMemory | undefined = config.vector
    ? createVectorMemory(config.vector)
    : undefined;

  const hooks: AgentHooks = {
    async onStart(input: string): Promise<void> {
      // Load persistent memory from disk if configured
      await persistent.load();

      // Record the user message in conversation memory
      conversation.add({ role: "user", content: input });
    },

    async onEnd(response: AgentResponse): Promise<void> {
      // Record the assistant response in conversation memory
      conversation.add({ role: "assistant", content: response.text });

      // Persist to disk if configured
      await persistent.save();
    },
  };

  return {
    conversation,
    persistent,
    vector,
    hooks,
  };
}
