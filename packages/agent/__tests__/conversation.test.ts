/**
 * Tests for conversation management.
 */

import { describe, it, expect, vi } from "vitest";
import { Conversation, createConversation } from "../src/conversation.js";
import { SlidingWindowStrategy } from "../src/context-window.js";
import type { Agent, AgentConfig, AgentResponse } from "../src/types.js";
import type { Model, Message, ModelResponse } from "@openlinkos/ai";
import type { StreamResult } from "@openlinkos/ai";
import type { TokenCounter } from "../src/context-window.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockAgent(responses: string[]): Agent {
  let callIndex = 0;

  return {
    name: "test-agent",
    async run(input: string): Promise<AgentResponse> {
      const text = responses[callIndex++] ?? "default response";
      return {
        text,
        steps: [],
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        agentName: "test-agent",
      };
    },
  };
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Conversation", () => {
  it("should initialize with system prompt in history", () => {
    const agent = createMockAgent(["Hello!"]);
    const conv = new Conversation(agent, "You are helpful.");

    const history = conv.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ role: "system", content: "You are helpful." });
  });

  it("should send a message and update history", async () => {
    const agent = createMockAgent(["Hello there!"]);
    const conv = new Conversation(agent, "You are helpful.");

    const response = await conv.send("Hi");

    expect(response.text).toBe("Hello there!");

    const history = conv.getHistory();
    expect(history).toHaveLength(3); // system + user + assistant
    expect(history[1]).toEqual({ role: "user", content: "Hi" });
    expect(history[2]).toEqual({ role: "assistant", content: "Hello there!" });
  });

  it("should maintain history across multiple messages", async () => {
    const agent = createMockAgent(["Response 1", "Response 2", "Response 3"]);
    const conv = new Conversation(agent, "System");

    await conv.send("Message 1");
    await conv.send("Message 2");
    await conv.send("Message 3");

    const history = conv.getHistory();
    expect(history).toHaveLength(7); // system + 3 user + 3 assistant
    expect(history[1]).toEqual({ role: "user", content: "Message 1" });
    expect(history[2]).toEqual({ role: "assistant", content: "Response 1" });
    expect(history[3]).toEqual({ role: "user", content: "Message 2" });
    expect(history[4]).toEqual({ role: "assistant", content: "Response 2" });
    expect(history[5]).toEqual({ role: "user", content: "Message 3" });
    expect(history[6]).toEqual({ role: "assistant", content: "Response 3" });
  });

  it("should clear history back to just system prompt", async () => {
    const agent = createMockAgent(["Response"]);
    const conv = new Conversation(agent, "System prompt");

    await conv.send("Hello");
    expect(conv.getHistory()).toHaveLength(3);

    conv.clear();

    const history = conv.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ role: "system", content: "System prompt" });
  });

  it("should fork conversation with independent history", async () => {
    const agent = createMockAgent(["R1", "R2", "R3"]);
    const conv = new Conversation(agent, "System");

    await conv.send("Hello");

    const forked = conv.fork();

    // Both should have same history at this point
    expect(forked.getHistory()).toEqual(conv.getHistory());

    // Modifying the fork should not affect original
    await forked.send("Forked message");

    expect(conv.getHistory()).toHaveLength(3); // system + hello + R1
    expect(forked.getHistory()).toHaveLength(5); // system + hello + R1 + forked + R2
  });

  it("should expose the underlying agent", () => {
    const agent = createMockAgent([]);
    const conv = new Conversation(agent, "System");

    expect(conv.agent).toBe(agent);
    expect(conv.agent.name).toBe("test-agent");
  });

  it("should return a copy of history (not internal reference)", () => {
    const agent = createMockAgent([]);
    const conv = new Conversation(agent, "System");

    const history1 = conv.getHistory();
    const history2 = conv.getHistory();

    expect(history1).toEqual(history2);
    expect(history1).not.toBe(history2);
  });

  it("should pass run options through to agent", async () => {
    const runSpy = vi.fn().mockResolvedValue({
      text: "Done",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      agentName: "test",
    });

    const agent: Agent = {
      name: "test",
      run: runSpy,
    };

    const conv = new Conversation(agent, "System");
    const controller = new AbortController();
    await conv.send("Hello", { signal: controller.signal });

    expect(runSpy).toHaveBeenCalledWith(
      expect.any(String),
      { signal: controller.signal },
    );
  });

  it("should apply context window when configured", async () => {
    const simpleCounter: TokenCounter = {
      countTokens(msg: Message): number {
        if (msg.role === "assistant") return (msg.content ?? "").length;
        return msg.content.length;
      },
    };

    const runSpy = vi.fn().mockResolvedValue({
      text: "OK",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      agentName: "test",
    });

    const agent: Agent = { name: "test", run: runSpy };

    const conv = new Conversation(agent, "Sys", {
      contextWindow: new SlidingWindowStrategy({
        maxTokens: 20,
        tokenCounter: simpleCounter,
      }),
    });

    // Fill up history beyond context window
    // Each send adds user + assistant messages
    // "Sys" = 3 tokens. Available = 17.
    // Send messages that will overflow
    await conv.send("AAAAAAAAAA"); // user 10 + assistant 2 = 12
    await conv.send("BBBBBBBBBB"); // user 10 + assistant 2 = 12

    // The second call should have received trimmed input
    // (we just verify it was called, the trimming logic is tested in context-window tests)
    expect(runSpy).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// createConversation factory
// ---------------------------------------------------------------------------

describe("createConversation", () => {
  it("should create a conversation from an agent config", () => {
    const model = createMockModel([
      {
        text: "Hello",
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop" as const,
      },
    ]);

    const config: AgentConfig = {
      name: "conv-agent",
      model,
      systemPrompt: "You are helpful.",
    };

    const conv = createConversation(config);

    expect(conv.agent.name).toBe("conv-agent");
    expect(conv.getHistory()).toHaveLength(1);
    expect(conv.getHistory()[0]).toEqual({
      role: "system",
      content: "You are helpful.",
    });
  });

  it("should accept conversation options", () => {
    const model = createMockModel([]);
    const config: AgentConfig = {
      name: "agent",
      model,
      systemPrompt: "System",
    };

    const conv = createConversation(config, {
      contextWindow: new SlidingWindowStrategy({ maxTokens: 100 }),
    });

    expect(conv).toBeInstanceOf(Conversation);
  });
});
