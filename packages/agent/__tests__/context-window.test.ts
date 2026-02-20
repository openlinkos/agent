/**
 * Tests for context window management.
 */

import { describe, it, expect } from "vitest";
import {
  CharBasedTokenCounter,
  SlidingWindowStrategy,
} from "../src/context-window.js";
import type { Message } from "@openlinkos/ai";
import type { TokenCounter } from "../src/context-window.js";

// ---------------------------------------------------------------------------
// CharBasedTokenCounter
// ---------------------------------------------------------------------------

describe("CharBasedTokenCounter", () => {
  it("should estimate tokens based on character count", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "user", content: "Hello world!" }; // 12 chars → 3 tokens
    expect(counter.countTokens(msg)).toBe(3);
  });

  it("should use custom chars-per-token ratio", () => {
    const counter = new CharBasedTokenCounter(2);
    const msg: Message = { role: "user", content: "Hello!" }; // 6 chars / 2 = 3
    expect(counter.countTokens(msg)).toBe(3);
  });

  it("should handle empty content", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "user", content: "" };
    expect(counter.countTokens(msg)).toBe(0);
  });

  it("should handle system messages", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "system", content: "You are helpful." }; // 16 chars → 4 tokens
    expect(counter.countTokens(msg)).toBe(4);
  });

  it("should handle assistant messages with null content", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "assistant", content: null, toolCalls: [] };
    expect(counter.countTokens(msg)).toBe(0);
  });

  it("should include tool calls in assistant message token count", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = {
      role: "assistant",
      content: "Let me check.",
      toolCalls: [{ id: "tc1", name: "search", arguments: { q: "test" } }],
    };
    const tokens = counter.countTokens(msg);
    // Should be more than just the text content
    const textOnly = new CharBasedTokenCounter().countTokens({
      role: "assistant",
      content: "Let me check.",
    });
    expect(tokens).toBeGreaterThan(textOnly);
  });

  it("should ceil fractional token counts", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "user", content: "Hi" }; // 2 chars / 4 = 0.5 → ceil to 1
    expect(counter.countTokens(msg)).toBe(1);
  });

  it("should handle tool messages", () => {
    const counter = new CharBasedTokenCounter();
    const msg: Message = { role: "tool", toolCallId: "tc1", content: "Result data here" };
    expect(counter.countTokens(msg)).toBe(4); // 16 chars / 4 = 4
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowStrategy
// ---------------------------------------------------------------------------

describe("SlidingWindowStrategy", () => {
  // Use a simple counter: 1 char = 1 token for predictable tests
  const simpleCounter: TokenCounter = {
    countTokens(msg: Message): number {
      if (msg.role === "assistant") return (msg.content ?? "").length;
      return msg.content.length;
    },
  };

  it("should return all messages when within token limit", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 1000,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = strategy.apply(messages);
    expect(result).toEqual(messages);
  });

  it("should preserve system messages and drop oldest non-system messages", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 20,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "Sys" },       // 3 tokens (always kept)
      { role: "user", content: "First msg" },    // 9 tokens → should be dropped
      { role: "assistant", content: "Reply1" },  // 6 tokens → should be dropped
      { role: "user", content: "Second" },       // 6 tokens → kept
      { role: "assistant", content: "Reply2" },  // 6 tokens → kept
    ];

    // Available = 20 - 3 = 17. Non-system total = 9+6+6+6 = 27 > 17
    // Drop "First msg" (9) → 18 still > 17
    // Drop "Reply1" (6) → 12 ≤ 17 ✓
    const result = strategy.apply(messages);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: "system", content: "Sys" });
    expect(result[1]).toEqual({ role: "user", content: "Second" });
    expect(result[2]).toEqual({ role: "assistant", content: "Reply2" });
  });

  it("should return only system messages when they exceed the limit", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 5,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "Very long system prompt here" },
      { role: "user", content: "Hello" },
    ];

    const result = strategy.apply(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("system");
  });

  it("should handle empty message list", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 100,
      tokenCounter: simpleCounter,
    });

    const result = strategy.apply([]);
    expect(result).toEqual([]);
  });

  it("should handle only system messages", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 100,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "System prompt" },
    ];

    const result = strategy.apply(messages);
    expect(result).toEqual(messages);
  });

  it("should use default CharBasedTokenCounter when none provided", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 10,
    });

    // With CharBasedTokenCounter (4 chars/token):
    // "Sys" = 1 token, "Hello world there!" = 5 tokens → total 6 ≤ 10
    const messages: Message[] = [
      { role: "system", content: "Sys" },
      { role: "user", content: "Hello world there!" },
    ];

    const result = strategy.apply(messages);
    expect(result).toEqual(messages);
  });

  it("should drop multiple messages if needed", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 15,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "Sys" },       // 3 tokens
      { role: "user", content: "AAAAAAA" },     // 7 tokens → drop
      { role: "assistant", content: "BBBBB" },  // 5 tokens → drop
      { role: "user", content: "CCCCC" },       // 5 tokens → drop
      { role: "assistant", content: "DD" },      // 2 tokens → keep
      { role: "user", content: "EEE" },          // 3 tokens → keep
    ];

    // Available = 15 - 3 = 12. Non-system = 7+5+5+2+3 = 22 > 12
    // Drop AAAAAAA (7) → 15 > 12
    // Drop BBBBB (5) → 10 ≤ 12 ✓
    const result = strategy.apply(messages);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe("system");
    expect(result[1]).toEqual({ role: "user", content: "CCCCC" });
  });

  it("should count total tokens across all messages", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 100,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "Hello" },  // 5
      { role: "user", content: "World" },    // 5
    ];

    expect(strategy.countTotal(messages)).toBe(10);
  });

  it("should not mutate the original messages array", () => {
    const strategy = new SlidingWindowStrategy({
      maxTokens: 10,
      tokenCounter: simpleCounter,
    });

    const messages: Message[] = [
      { role: "system", content: "Sys" },
      { role: "user", content: "AAAAAAAAAA" },
      { role: "user", content: "BB" },
    ];

    const original = [...messages];
    strategy.apply(messages);
    expect(messages).toEqual(original);
  });
});
