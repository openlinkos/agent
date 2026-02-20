/**
 * Tests for short-term conversation memory.
 */

import { describe, it, expect } from "vitest";
import { createConversationMemory } from "../src/conversation.js";

describe("createConversationMemory", () => {
  it("should create an empty conversation memory", () => {
    const mem = createConversationMemory();
    expect(mem.length).toBe(0);
    expect(mem.getMessages()).toEqual([]);
  });

  it("should add and retrieve messages", () => {
    const mem = createConversationMemory();
    mem.add({ role: "user", content: "Hello" });
    mem.add({ role: "assistant", content: "Hi there!" });

    expect(mem.length).toBe(2);
    const messages = mem.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
  });

  it("should return a copy of messages (not a reference)", () => {
    const mem = createConversationMemory();
    mem.add({ role: "user", content: "A" });

    const copy = mem.getMessages();
    copy.push({ role: "assistant", content: "B" });

    expect(mem.length).toBe(1);
  });

  it("should clear messages", () => {
    const mem = createConversationMemory();
    mem.add({ role: "user", content: "Hello" });
    mem.add({ role: "assistant", content: "Hi" });
    expect(mem.length).toBe(2);

    mem.clear();
    expect(mem.length).toBe(0);
    expect(mem.getMessages()).toEqual([]);
  });

  it("should trim by maxMessages", () => {
    const mem = createConversationMemory({ maxMessages: 3 });

    mem.add({ role: "user", content: "A" });
    mem.add({ role: "assistant", content: "B" });
    mem.add({ role: "user", content: "C" });
    mem.add({ role: "assistant", content: "D" });

    expect(mem.length).toBe(3);
    const messages = mem.getMessages();
    expect(messages[0].content).toBe("B");
    expect(messages[1].content).toBe("C");
    expect(messages[2].content).toBe("D");
  });

  it("should trim by maxChars", () => {
    const mem = createConversationMemory({ maxChars: 10 });

    mem.add({ role: "user", content: "AAAA" }); // 4 chars
    mem.add({ role: "assistant", content: "BBBB" }); // 4 chars, total 8
    mem.add({ role: "user", content: "CCCC" }); // 4 chars, total 12 -> trim oldest

    // After trim: "BBBB" (4) + "CCCC" (4) = 8 <= 10
    expect(mem.length).toBe(2);
    const messages = mem.getMessages();
    expect(messages[0].content).toBe("BBBB");
    expect(messages[1].content).toBe("CCCC");
  });

  it("should handle maxChars smaller than a single message", () => {
    const mem = createConversationMemory({ maxChars: 3 });

    mem.add({ role: "user", content: "AAAAAAA" }); // 7 chars > 3

    // Single message exceeds maxChars, but we keep at least zero
    expect(mem.length).toBe(0);
  });

  it("should handle both maxMessages and maxChars together", () => {
    const mem = createConversationMemory({ maxMessages: 10, maxChars: 15 });

    mem.add({ role: "user", content: "12345" }); // 5
    mem.add({ role: "assistant", content: "12345" }); // 10
    mem.add({ role: "user", content: "12345" }); // 15
    mem.add({ role: "assistant", content: "12345" }); // 20 -> trim

    expect(mem.length).toBe(3);
    expect(mem.getMessages()[0].content).toBe("12345");
  });

  it("should use defaults when no config provided", () => {
    const mem = createConversationMemory();

    // Add 50 messages — should all fit under default maxMessages: 50
    for (let i = 0; i < 50; i++) {
      mem.add({ role: "user", content: `msg-${i}` });
    }
    expect(mem.length).toBe(50);

    // 51st should trim
    mem.add({ role: "user", content: "overflow" });
    expect(mem.length).toBe(50);
    expect(mem.getMessages()[49].content).toBe("overflow");
  });
});
