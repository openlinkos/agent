/**
 * @openlinkos/plugin-memory — Persistent memory plugin for agents.
 *
 * Provides vector storage, semantic retrieval, and configurable retention
 * policies to give agents long-term memory across conversations.
 *
 * @packageDocumentation
 */

export interface MemoryEntry {
  /** Unique identifier for the memory entry. */
  id: string;
  /** The content stored in memory. */
  content: string;
  /** Metadata associated with the memory entry. */
  metadata: Record<string, unknown>;
  /** Timestamp when the memory was created. */
  createdAt: Date;
  /** Relevance score from the last retrieval (0-1). */
  score?: number;
}

export interface MemoryConfig {
  /** Storage backend to use. */
  backend: "in-memory" | "sqlite" | "postgres";
  /** Maximum number of entries to retain. */
  maxEntries?: number;
  /** Embedding model for semantic search. */
  embeddingModel?: string;
  /** Retention policy for old entries. */
  retentionPolicy?: "fifo" | "lru" | "relevance";
}

export interface MemoryStore {
  /** Store a new memory entry. */
  store(content: string, metadata?: Record<string, unknown>): Promise<MemoryEntry>;
  /** Retrieve memories semantically similar to the query. */
  retrieve(query: string, limit?: number): Promise<MemoryEntry[]>;
  /** Delete a memory entry by ID. */
  delete(id: string): Promise<boolean>;
  /** Clear all memory entries. */
  clear(): Promise<void>;
  /** Get the total number of stored entries. */
  count(): Promise<number>;
}

/**
 * Create a persistent memory store for an agent.
 *
 * @param config - Memory store configuration.
 * @returns A MemoryStore instance.
 *
 * @example
 * ```typescript
 * import { createMemoryStore } from "@openlinkos/plugin-memory";
 *
 * const memory = createMemoryStore({
 *   backend: "sqlite",
 *   maxEntries: 10000,
 *   retentionPolicy: "relevance",
 * });
 *
 * await memory.store("User prefers dark mode", { category: "preferences" });
 * const results = await memory.retrieve("What are the user's UI preferences?");
 * ```
 */
export function createMemoryStore(_config: MemoryConfig): MemoryStore {
  throw new Error(
    "MemoryStore is not yet implemented. This is a scaffold — the memory plugin is coming in Phase 5."
  );
}
