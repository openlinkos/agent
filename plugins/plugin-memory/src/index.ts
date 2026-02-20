/**
 * @openlinkos/plugin-memory — Persistent memory plugin for agents.
 *
 * Provides short-term conversation memory, long-term key-value persistence,
 * and semantic vector memory with similarity search. Integrates with the
 * @openlinkos/agent lifecycle via hooks.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  MemoryEntry,
  ScoredMemoryEntry,
  ConversationMessage,
  MemoryStore,
  EmbeddingFunction,
  ConversationMemoryConfig,
  MemoryCategory,
  PersistentMemoryConfig,
  VectorMemoryConfig,
  MemoryPluginConfig,
  MemoryPlugin,
  ConversationMemory,
  PersistentMemory,
  VectorMemory,
} from "./types.js";

// --- Conversation (short-term) memory ---
export { createConversationMemory } from "./conversation.js";

// --- Persistent (long-term) memory ---
export { createPersistentMemory } from "./persistent.js";

// --- Semantic vector memory ---
export { createVectorMemory, cosineSimilarity } from "./vector.js";

// --- Plugin integration ---
export { createMemoryPlugin } from "./plugin.js";
