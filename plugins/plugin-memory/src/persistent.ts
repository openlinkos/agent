/**
 * Long-term persistent memory — key-value store with categories and TTL.
 *
 * Supports optional JSON file-based persistence. Entries are timestamped and
 * can expire via TTL. Categories allow logical grouping (user_facts,
 * agent_learnings, task_history).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  PersistentMemory,
  PersistentMemoryConfig,
  MemoryCategory,
  MemoryEntry,
} from "./types.js";

/** Internal storage record for a persistent memory entry. */
interface StoredEntry {
  key: string;
  value: string;
  category: MemoryCategory;
  createdAt: number;
  ttl?: number;
}

function isExpired(entry: StoredEntry, now: number): boolean {
  if (entry.ttl === undefined) return false;
  return now - entry.createdAt > entry.ttl;
}

function toMemoryEntry(key: string, entry: StoredEntry): MemoryEntry {
  return {
    id: key,
    content: entry.value,
    metadata: { category: entry.category, key: entry.key },
    createdAt: entry.createdAt,
    ttl: entry.ttl,
  };
}

/**
 * Create a long-term persistent memory store.
 *
 * @param config - Optional configuration (file path for persistence).
 * @returns A {@link PersistentMemory} instance.
 *
 * @example
 * ```typescript
 * import { createPersistentMemory } from "@openlinkos/plugin-memory";
 *
 * const memory = createPersistentMemory({ filePath: "./memory.json" });
 * await memory.load();
 * await memory.set("theme", "dark", "user_facts");
 * const theme = await memory.get("theme"); // "dark"
 * await memory.save();
 * ```
 */
export function createPersistentMemory(
  config: PersistentMemoryConfig = {},
): PersistentMemory {
  const store = new Map<string, StoredEntry>();
  const filePath = config.filePath;

  function pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (isExpired(entry, now)) {
        store.delete(key);
      }
    }
  }

  return {
    async set(key: string, value: string, category: MemoryCategory, ttl?: number): Promise<void> {
      store.set(key, {
        key,
        value,
        category,
        createdAt: Date.now(),
        ttl,
      });
    },

    async get(key: string): Promise<string | undefined> {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (isExpired(entry, Date.now())) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    async delete(key: string): Promise<boolean> {
      return store.delete(key);
    },

    async list(category?: MemoryCategory): Promise<MemoryEntry[]> {
      pruneExpired();
      const results: MemoryEntry[] = [];
      for (const [key, entry] of store) {
        if (category === undefined || entry.category === category) {
          results.push(toMemoryEntry(key, entry));
        }
      }
      return results;
    },

    async clear(): Promise<void> {
      store.clear();
    },

    async save(): Promise<void> {
      if (!filePath) return;
      pruneExpired();
      const data: Record<string, StoredEntry> = {};
      for (const [key, entry] of store) {
        data[key] = entry;
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    },

    async load(): Promise<void> {
      if (!filePath) return;
      let raw: string;
      try {
        raw = await readFile(filePath, "utf-8");
      } catch {
        // File doesn't exist yet — start empty
        return;
      }
      const data = JSON.parse(raw) as Record<string, StoredEntry>;
      store.clear();
      const now = Date.now();
      for (const [key, entry] of Object.entries(data)) {
        if (!isExpired(entry, now)) {
          store.set(key, entry);
        }
      }
    },
  };
}
