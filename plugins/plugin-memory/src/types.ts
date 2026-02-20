/**
 * Core types for @openlinkos/plugin-memory.
 *
 * Defines memory entries, store interfaces, configuration, and plugin hooks
 * for short-term, long-term, and semantic memory.
 */

import type { AgentHooks } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// Memory entries
// ---------------------------------------------------------------------------

/** A single memory entry stored in any memory backend. */
export interface MemoryEntry {
  /** Unique identifier. */
  id: string;
  /** The content of the memory. */
  content: string;
  /** Arbitrary metadata attached to the entry. */
  metadata: Record<string, unknown>;
  /** When the entry was created. */
  createdAt: number;
  /** Optional TTL in milliseconds. `undefined` means no expiry. */
  ttl?: number;
}

/** A memory entry augmented with a similarity score (0–1). */
export interface ScoredMemoryEntry extends MemoryEntry {
  /** Relevance / similarity score in the range [0, 1]. */
  score: number;
}

// ---------------------------------------------------------------------------
// Message type for conversation memory
// ---------------------------------------------------------------------------

/** A single message in a conversation. */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Memory store interface (pluggable backend)
// ---------------------------------------------------------------------------

/** A generic key-value memory store with optional semantic search. */
export interface MemoryStore {
  /** Store a new entry. Returns the created entry. */
  put(entry: Omit<MemoryEntry, "id" | "createdAt">): Promise<MemoryEntry>;
  /** Retrieve an entry by ID. */
  get(id: string): Promise<MemoryEntry | undefined>;
  /** Delete an entry by ID. Returns true if it existed. */
  delete(id: string): Promise<boolean>;
  /** List all entries, optionally filtered by a metadata predicate. */
  list(filter?: (entry: MemoryEntry) => boolean): Promise<MemoryEntry[]>;
  /** Remove all entries. */
  clear(): Promise<void>;
  /** Number of stored entries. */
  size(): Promise<number>;
}

/** An embedding function that maps text to a numeric vector. */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

// ---------------------------------------------------------------------------
// Conversation (short-term) memory config
// ---------------------------------------------------------------------------

/** Configuration for the short-term conversation memory buffer. */
export interface ConversationMemoryConfig {
  /** Maximum number of messages to retain. Default: 50. */
  maxMessages?: number;
  /** Maximum total characters across all messages. Default: 100 000. */
  maxChars?: number;
}

// ---------------------------------------------------------------------------
// Persistent (long-term) memory config
// ---------------------------------------------------------------------------

/** Valid categories for long-term memory entries. */
export type MemoryCategory = "user_facts" | "agent_learnings" | "task_history";

/** Configuration for long-term persistent memory. */
export interface PersistentMemoryConfig {
  /** File path for JSON persistence. If omitted, operates in-memory only. */
  filePath?: string;
}

// ---------------------------------------------------------------------------
// Vector (semantic) memory config
// ---------------------------------------------------------------------------

/** Configuration for the semantic vector memory. */
export interface VectorMemoryConfig {
  /** Function to compute embeddings. Required for semantic search. */
  embed: EmbeddingFunction;
  /** Number of results to return by default. Default: 5. */
  defaultTopK?: number;
}

// ---------------------------------------------------------------------------
// Plugin config (top-level)
// ---------------------------------------------------------------------------

/** Configuration for the memory plugin. */
export interface MemoryPluginConfig {
  /** Short-term conversation memory settings. */
  conversation?: ConversationMemoryConfig;
  /** Long-term persistent memory settings. */
  persistent?: PersistentMemoryConfig;
  /** Semantic vector memory settings. Omit to disable vector memory. */
  vector?: VectorMemoryConfig;
}

// ---------------------------------------------------------------------------
// Plugin interface
// ---------------------------------------------------------------------------

/** The memory plugin instance returned by `createMemoryPlugin`. */
export interface MemoryPlugin {
  /** The conversation (short-term) memory buffer. */
  readonly conversation: ConversationMemory;
  /** The persistent (long-term) key-value memory. */
  readonly persistent: PersistentMemory;
  /** The semantic vector memory, if configured. */
  readonly vector: VectorMemory | undefined;
  /** Agent hooks that wire memory into the agent lifecycle. */
  readonly hooks: AgentHooks;
}

// ---------------------------------------------------------------------------
// Memory sub-system interfaces
// ---------------------------------------------------------------------------

/** Short-term conversation memory. */
export interface ConversationMemory {
  /** Add a message to the conversation buffer. */
  add(message: ConversationMessage): void;
  /** Get all messages currently in the buffer. */
  getMessages(): ConversationMessage[];
  /** Clear the buffer. */
  clear(): void;
  /** Number of messages in the buffer. */
  readonly length: number;
}

/** Long-term persistent memory. */
export interface PersistentMemory {
  /** Store a fact under a category. */
  set(key: string, value: string, category: MemoryCategory, ttl?: number): Promise<void>;
  /** Retrieve a fact by key. Returns undefined if missing or expired. */
  get(key: string): Promise<string | undefined>;
  /** Delete a fact by key. */
  delete(key: string): Promise<boolean>;
  /** List all facts, optionally filtered by category. */
  list(category?: MemoryCategory): Promise<MemoryEntry[]>;
  /** Remove all facts. */
  clear(): Promise<void>;
  /** Persist to disk (if filePath configured). */
  save(): Promise<void>;
  /** Load from disk (if filePath configured). */
  load(): Promise<void>;
}

/** Semantic vector memory. */
export interface VectorMemory {
  /** Add content to the vector store. */
  add(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry>;
  /** Search for the most similar entries. */
  search(query: string, topK?: number): Promise<ScoredMemoryEntry[]>;
  /** Remove an entry by ID. */
  delete(id: string): Promise<boolean>;
  /** Remove all entries. */
  clear(): Promise<void>;
  /** Number of stored entries. */
  readonly size: number;
}
