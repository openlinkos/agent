/**
 * Session management for @openlinkos/agent.
 *
 * Manages multiple Conversation instances by session ID, with optional
 * persistence for saving and restoring conversations across restarts.
 */

import type { AgentConfig } from "./types.js";
import { Conversation, type ConversationOptions } from "./conversation.js";
import { createAgentEngine } from "./agent.js";
import type { ConversationStore, ConversationData } from "./persistence.js";

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

/** Options for creating a SessionManager. */
export interface SessionManagerOptions {
  /** Agent configuration used for all sessions. */
  agentConfig: AgentConfig;
  /** Optional conversation options (e.g. context window). */
  conversationOptions?: ConversationOptions;
  /** Optional persistence store for saving/loading sessions. */
  store?: ConversationStore;
}

/** Manages multiple conversation sessions by ID. */
export class SessionManager {
  private readonly sessions = new Map<string, Conversation>();
  private readonly agentConfig: AgentConfig;
  private readonly conversationOptions?: ConversationOptions;
  private readonly store?: ConversationStore;

  constructor(options: SessionManagerOptions) {
    this.agentConfig = options.agentConfig;
    this.conversationOptions = options.conversationOptions;
    this.store = options.store;
  }

  /**
   * Get or create a session by ID.
   *
   * If the session doesn't exist in memory, attempts to load from the
   * persistence store (if configured). Creates a new session if not found.
   */
  async getSession(sessionId: string): Promise<Conversation> {
    // Check in-memory cache first
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    // Try to load from store
    if (this.store) {
      const data = await this.store.load(sessionId);
      if (data) {
        const agent = createAgentEngine(this.agentConfig);
        const conversation = new Conversation(
          agent,
          this.agentConfig.systemPrompt,
          this.conversationOptions,
        );
        // Restore history
        for (const msg of data.messages) {
          if (msg.role !== "system") {
            conversation.getHistory().push(msg);
          }
        }
        this.sessions.set(sessionId, conversation);
        return conversation;
      }
    }

    // Create new session
    const agent = createAgentEngine(this.agentConfig);
    const conversation = new Conversation(
      agent,
      this.agentConfig.systemPrompt,
      this.conversationOptions,
    );
    this.sessions.set(sessionId, conversation);
    return conversation;
  }

  /** List all active session IDs (in-memory). */
  listSessions(): string[] {
    return [...this.sessions.keys()];
  }

  /**
   * Delete a session by ID.
   *
   * Removes from memory and from the persistence store if configured.
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    if (this.store) {
      await this.store.delete(sessionId);
    }
  }

  /**
   * Save a session to the persistence store.
   *
   * No-op if no store is configured.
   */
  async saveSession(sessionId: string): Promise<void> {
    if (!this.store) return;

    const conversation = this.sessions.get(sessionId);
    if (!conversation) return;

    const now = new Date().toISOString();
    const data: ConversationData = {
      sessionId,
      messages: conversation.getHistory(),
      createdAt: now,
      updatedAt: now,
    };

    await this.store.save(data);
  }
}
