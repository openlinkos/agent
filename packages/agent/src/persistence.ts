/**
 * Persistence layer for @openlinkos/agent conversations.
 *
 * Provides a ConversationStore interface with InMemoryStore and FileStore
 * implementations for saving/loading conversation history.
 */

import type { Message } from "@openlinkos/ai";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

/** Serializable conversation data for persistence. */
export interface ConversationData {
  /** Unique session identifier. */
  sessionId: string;
  /** The full message history. */
  messages: Message[];
  /** ISO timestamp of when the conversation was created. */
  createdAt: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
}

/** Interface for persisting conversation data. */
export interface ConversationStore {
  /** Save conversation data, creating or overwriting. */
  save(data: ConversationData): Promise<void>;
  /** Load conversation data by session ID. Returns null if not found. */
  load(sessionId: string): Promise<ConversationData | null>;
  /** Delete conversation data by session ID. */
  delete(sessionId: string): Promise<void>;
  /** List all stored session IDs. */
  list(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// InMemoryStore
// ---------------------------------------------------------------------------

/** In-memory conversation store. Data is lost when the process exits. */
export class InMemoryStore implements ConversationStore {
  private readonly store = new Map<string, ConversationData>();

  async save(data: ConversationData): Promise<void> {
    this.store.set(data.sessionId, { ...data, messages: [...data.messages] });
  }

  async load(sessionId: string): Promise<ConversationData | null> {
    const data = this.store.get(sessionId);
    if (!data) return null;
    return { ...data, messages: [...data.messages] };
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }
}

// ---------------------------------------------------------------------------
// FileStore
// ---------------------------------------------------------------------------

/** File-based conversation store using JSON files. */
export class FileStore implements ConversationStore {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  async save(data: ConversationData): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    const filePath = this.filePath(data.sessionId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async load(sessionId: string): Promise<ConversationData | null> {
    const filePath = this.filePath(sessionId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as ConversationData;
    } catch {
      return null;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const filePath = this.filePath(sessionId);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }

  private filePath(sessionId: string): string {
    // Sanitize session ID to prevent path traversal
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.directory, `${safe}.json`);
  }
}
