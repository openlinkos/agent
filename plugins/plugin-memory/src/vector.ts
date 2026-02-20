/**
 * Semantic vector memory — embedding-based storage and similarity search.
 *
 * Uses a pluggable embedding function to convert text into vectors, then
 * stores them in-memory with brute-force cosine similarity search.
 * The interface is designed to be swappable for external vector DBs.
 */

import type {
  VectorMemory,
  VectorMemoryConfig,
  MemoryEntry,
  ScoredMemoryEntry,
  EmbeddingFunction,
} from "./types.js";

/** Internal record pairing a memory entry with its embedding vector. */
interface VectorRecord {
  entry: MemoryEntry;
  vector: number[];
}

let nextId = 1;

function generateId(): string {
  return `vec_${Date.now()}_${nextId++}`;
}

/** Compute cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Create a semantic vector memory store.
 *
 * @param config - Configuration including the embedding function.
 * @returns A {@link VectorMemory} instance.
 *
 * @example
 * ```typescript
 * import { createVectorMemory } from "@openlinkos/plugin-memory";
 *
 * const memory = createVectorMemory({
 *   embed: async (text) => myEmbeddingModel.embed(text),
 *   defaultTopK: 3,
 * });
 *
 * await memory.add("The capital of France is Paris");
 * const results = await memory.search("What is France's capital?");
 * ```
 */
export function createVectorMemory(config: VectorMemoryConfig): VectorMemory {
  const embed: EmbeddingFunction = config.embed;
  const defaultTopK = config.defaultTopK ?? 5;

  const records: VectorRecord[] = [];

  return {
    async add(content: string, metadata: Record<string, unknown> = {}): Promise<MemoryEntry> {
      const vector = await embed(content);
      const entry: MemoryEntry = {
        id: generateId(),
        content,
        metadata,
        createdAt: Date.now(),
      };
      records.push({ entry, vector });
      return entry;
    },

    async search(query: string, topK?: number): Promise<ScoredMemoryEntry[]> {
      const k = topK ?? defaultTopK;
      if (records.length === 0) return [];

      const queryVec = await embed(query);

      const scored: ScoredMemoryEntry[] = records.map((rec) => ({
        ...rec.entry,
        score: cosineSimilarity(queryVec, rec.vector),
      }));

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    },

    async delete(id: string): Promise<boolean> {
      const idx = records.findIndex((r) => r.entry.id === id);
      if (idx === -1) return false;
      records.splice(idx, 1);
      return true;
    },

    async clear(): Promise<void> {
      records.length = 0;
    },

    get size(): number {
      return records.length;
    },
  };
}
