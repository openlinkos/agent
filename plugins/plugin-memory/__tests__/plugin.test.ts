/**
 * Tests for the memory plugin integration with agent lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryPlugin } from "../src/plugin.js";
import type { AgentResponse } from "@openlinkos/agent";
import type { EmbeddingFunction } from "../src/types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(text: string): AgentResponse {
  return {
    text,
    steps: [],
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    agentName: "test-agent",
  };
}

const mockEmbed: EmbeddingFunction = async (text) => {
  const vec = new Array<number>(8).fill(0);
  for (let i = 0; i < text.length && i < 8; i++) {
    vec[i] = text.charCodeAt(i) / 256;
  }
  return vec;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createMemoryPlugin", () => {
  it("should create a plugin with conversation and persistent memory", () => {
    const plugin = createMemoryPlugin();

    expect(plugin.conversation).toBeDefined();
    expect(plugin.persistent).toBeDefined();
    expect(plugin.vector).toBeUndefined();
    expect(plugin.hooks).toBeDefined();
    expect(plugin.hooks.onStart).toBeTypeOf("function");
    expect(plugin.hooks.onEnd).toBeTypeOf("function");
  });

  it("should create a plugin with vector memory when configured", () => {
    const plugin = createMemoryPlugin({
      vector: { embed: mockEmbed },
    });

    expect(plugin.vector).toBeDefined();
  });

  it("should pass conversation config through", () => {
    const plugin = createMemoryPlugin({
      conversation: { maxMessages: 5 },
    });

    // Add 6 messages, only 5 should remain
    for (let i = 0; i < 6; i++) {
      plugin.conversation.add({ role: "user", content: `msg-${i}` });
    }
    expect(plugin.conversation.length).toBe(5);
  });
});

describe("Plugin hooks", () => {
  it("onStart should add user message to conversation memory", async () => {
    const plugin = createMemoryPlugin();

    await plugin.hooks.onStart!("Hello agent");

    const messages = plugin.conversation.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "Hello agent" });
  });

  it("onEnd should add assistant message to conversation memory", async () => {
    const plugin = createMemoryPlugin();
    const response = makeResponse("I can help!");

    await plugin.hooks.onEnd!(response);

    const messages = plugin.conversation.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "assistant", content: "I can help!" });
  });

  it("should build conversation history over multiple interactions", async () => {
    const plugin = createMemoryPlugin();

    // Simulate two turns
    await plugin.hooks.onStart!("Question 1");
    await plugin.hooks.onEnd!(makeResponse("Answer 1"));
    await plugin.hooks.onStart!("Question 2");
    await plugin.hooks.onEnd!(makeResponse("Answer 2"));

    const messages = plugin.conversation.getMessages();
    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ role: "user", content: "Question 1" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Answer 1" });
    expect(messages[2]).toEqual({ role: "user", content: "Question 2" });
    expect(messages[3]).toEqual({ role: "assistant", content: "Answer 2" });
  });
});

describe("Plugin with file persistence", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), "plugin-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("onStart should load persistent memory and onEnd should save it", async () => {
    const filePath = path.join(tmpDir, "persist.json");

    // First session: save some data
    const plugin1 = createMemoryPlugin({ persistent: { filePath } });
    await plugin1.persistent.set("user_name", "Alice", "user_facts");
    await plugin1.hooks.onEnd!(makeResponse("Nice to meet you, Alice!"));

    // Second session: data should be loaded on start
    const plugin2 = createMemoryPlugin({ persistent: { filePath } });
    await plugin2.hooks.onStart!("Remember me?");

    expect(await plugin2.persistent.get("user_name")).toBe("Alice");
  });
});

describe("Plugin with all memory types", () => {
  it("should coordinate all three memory systems", async () => {
    const plugin = createMemoryPlugin({
      conversation: { maxMessages: 10 },
      persistent: {},
      vector: { embed: mockEmbed, defaultTopK: 2 },
    });

    // Use persistent memory
    await plugin.persistent.set("pref", "dark-mode", "user_facts");

    // Use vector memory
    await plugin.vector!.add("The user likes TypeScript", { topic: "preferences" });
    await plugin.vector!.add("The user uses VS Code", { topic: "tools" });

    // Simulate agent interaction
    await plugin.hooks.onStart!("What are my preferences?");
    await plugin.hooks.onEnd!(makeResponse("You prefer dark mode and TypeScript."));

    // Verify all systems
    expect(plugin.conversation.length).toBe(2);
    expect(await plugin.persistent.get("pref")).toBe("dark-mode");
    const results = await plugin.vector!.search("TypeScript preference");
    expect(results.length).toBeGreaterThan(0);
  });
});
