/**
 * Tests for session management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionManager } from "../src/session.js";
import { InMemoryStore } from "../src/persistence.js";
import type { AgentConfig } from "../src/types.js";
import type { Model, Message, ModelResponse } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;

  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Stream not implemented");
    },
    async generateWithTools(): Promise<ModelResponse> {
      if (callIndex >= responses.length) {
        return {
          text: "No more responses",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        };
      }
      return responses[callIndex++];
    },
  };
}

function makeConfig(): AgentConfig {
  return {
    name: "session-agent",
    model: createMockModel([
      {
        text: "Hello!",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop" as const,
      },
    ]),
    systemPrompt: "You are helpful.",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionManager", () => {
  it("should create a new session on first access", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    const session = await manager.getSession("s1");
    expect(session).toBeDefined();
    expect(session.getHistory()).toHaveLength(1); // system prompt
    expect(session.agent.name).toBe("session-agent");
  });

  it("should return the same session for the same ID", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    const s1a = await manager.getSession("s1");
    const s1b = await manager.getSession("s1");

    expect(s1a).toBe(s1b);
  });

  it("should create different sessions for different IDs", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    const s1 = await manager.getSession("s1");
    const s2 = await manager.getSession("s2");

    expect(s1).not.toBe(s2);
  });

  it("should list active sessions", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    await manager.getSession("alpha");
    await manager.getSession("beta");
    await manager.getSession("gamma");

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(3);
    expect(sessions).toContain("alpha");
    expect(sessions).toContain("beta");
    expect(sessions).toContain("gamma");
  });

  it("should delete a session", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    await manager.getSession("s1");
    expect(manager.listSessions()).toContain("s1");

    await manager.deleteSession("s1");
    expect(manager.listSessions()).not.toContain("s1");
  });

  it("should handle deleting non-existent session", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });
    await expect(manager.deleteSession("nope")).resolves.toBeUndefined();
  });

  it("should return empty list when no sessions exist", () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });
    expect(manager.listSessions()).toEqual([]);
  });

  it("should create a fresh session after deletion", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });

    const s1 = await manager.getSession("s1");
    await manager.deleteSession("s1");
    const s1New = await manager.getSession("s1");

    expect(s1New).not.toBe(s1);
    expect(s1New.getHistory()).toHaveLength(1); // fresh system prompt
  });
});

// ---------------------------------------------------------------------------
// SessionManager with persistence
// ---------------------------------------------------------------------------

describe("SessionManager with persistence", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it("should save a session to the store", async () => {
    const manager = new SessionManager({
      agentConfig: makeConfig(),
      store,
    });

    const session = await manager.getSession("s1");
    // Add some history by directly manipulating (session.send would call model)
    expect(session.getHistory()).toHaveLength(1);

    await manager.saveSession("s1");

    const stored = await store.load("s1");
    expect(stored).not.toBeNull();
    expect(stored!.sessionId).toBe("s1");
    expect(stored!.messages).toHaveLength(1);
  });

  it("should delete from store when deleting session", async () => {
    const manager = new SessionManager({
      agentConfig: makeConfig(),
      store,
    });

    await manager.getSession("s1");
    await manager.saveSession("s1");
    expect(await store.load("s1")).not.toBeNull();

    await manager.deleteSession("s1");
    expect(await store.load("s1")).toBeNull();
  });

  it("should no-op saveSession when no store is configured", async () => {
    const manager = new SessionManager({ agentConfig: makeConfig() });
    await manager.getSession("s1");

    // Should not throw
    await expect(manager.saveSession("s1")).resolves.toBeUndefined();
  });

  it("should no-op saveSession for non-existent session", async () => {
    const manager = new SessionManager({
      agentConfig: makeConfig(),
      store,
    });

    await manager.saveSession("nonexistent");
    expect(await store.load("nonexistent")).toBeNull();
  });
});
