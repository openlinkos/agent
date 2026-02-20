/**
 * Tests for communication primitives: MessageBus, Blackboard, and handoff.
 */

import { describe, it, expect } from "vitest";
import {
  MessageBus,
  Blackboard,
  createHandoff,
  formatHandoffInput,
  createTeamContext,
} from "../src/communication.js";
import type { AgentResponse } from "@openlinkos/agent";

// ---------------------------------------------------------------------------
// MessageBus tests
// ---------------------------------------------------------------------------

describe("MessageBus", () => {
  it("should send and receive messages", () => {
    const bus = new MessageBus();

    bus.send("agent-a", "agent-b", "Hello B!");
    bus.send("agent-c", "agent-b", "Also hello B!");

    const messagesForB = bus.getFor("agent-b");

    expect(messagesForB).toHaveLength(2);
    expect(messagesForB[0].from).toBe("agent-a");
    expect(messagesForB[0].to).toBe("agent-b");
    expect(messagesForB[0].content).toBe("Hello B!");
    expect(messagesForB[1].from).toBe("agent-c");
  });

  it("should return empty array when no messages for agent", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "Hello");

    expect(bus.getFor("c")).toEqual([]);
  });

  it("should get messages sent by a specific agent", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "From A to B");
    bus.send("a", "c", "From A to C");
    bus.send("b", "a", "From B to A");

    const fromA = bus.getFrom("a");
    expect(fromA).toHaveLength(2);
    expect(fromA[0].to).toBe("b");
    expect(fromA[1].to).toBe("c");
  });

  it("should get all messages", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "1");
    bus.send("b", "c", "2");

    expect(bus.all()).toHaveLength(2);
  });

  it("should clear all messages", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "1");
    bus.clear();

    expect(bus.all()).toHaveLength(0);
  });

  it("should include timestamps", () => {
    const bus = new MessageBus();
    const before = Date.now();
    bus.send("a", "b", "Hello");
    const after = Date.now();

    const messages = bus.getFor("b");
    expect(messages[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(messages[0].timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Blackboard tests
// ---------------------------------------------------------------------------

describe("Blackboard", () => {
  it("should set and get values", () => {
    const bb = new Blackboard();
    bb.set("key1", "value1");
    bb.set("key2", 42);

    expect(bb.get("key1")).toBe("value1");
    expect(bb.get<number>("key2")).toBe(42);
  });

  it("should return undefined for missing keys", () => {
    const bb = new Blackboard();
    expect(bb.get("missing")).toBeUndefined();
  });

  it("should check key existence", () => {
    const bb = new Blackboard();
    bb.set("exists", true);

    expect(bb.has("exists")).toBe(true);
    expect(bb.has("missing")).toBe(false);
  });

  it("should delete keys", () => {
    const bb = new Blackboard();
    bb.set("key", "value");
    expect(bb.delete("key")).toBe(true);
    expect(bb.get("key")).toBeUndefined();
    expect(bb.delete("nonexistent")).toBe(false);
  });

  it("should clear all entries", () => {
    const bb = new Blackboard();
    bb.set("a", 1);
    bb.set("b", 2);
    bb.clear();

    expect(bb.has("a")).toBe(false);
    expect(bb.has("b")).toBe(false);
  });

  it("should expose underlying Map via toMap", () => {
    const bb = new Blackboard();
    bb.set("key", "value");

    const map = bb.toMap();
    expect(map.get("key")).toBe("value");
    expect(map instanceof Map).toBe(true);
  });

  it("should handle complex values", () => {
    const bb = new Blackboard();
    const obj = { nested: { data: [1, 2, 3] } };
    bb.set("complex", obj);

    expect(bb.get("complex")).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// Handoff tests
// ---------------------------------------------------------------------------

describe("Handoff", () => {
  it("should create a handoff from agent response", () => {
    const response: AgentResponse = {
      text: "Research findings about AI",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      agentName: "researcher",
    };

    const handoff = createHandoff("researcher", "writer", response);

    expect(handoff.fromAgent).toBe("researcher");
    expect(handoff.toAgent).toBe("writer");
    expect(handoff.output).toBe("Research findings about AI");
    expect(handoff.instructions).toBeUndefined();
  });

  it("should support instructions in handoff", () => {
    const response: AgentResponse = {
      text: "Raw data",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      agentName: "collector",
    };

    const handoff = createHandoff(
      "collector",
      "analyzer",
      response,
      "Focus on trends",
    );

    expect(handoff.instructions).toBe("Focus on trends");
  });

  it("should format handoff as input text", () => {
    const response: AgentResponse = {
      text: "Analysis complete",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      agentName: "analyzer",
    };

    const handoff = createHandoff("analyzer", "writer", response);
    const formatted = formatHandoffInput(handoff);

    expect(formatted).toContain("[Handoff from analyzer]");
    expect(formatted).toContain("Analysis complete");
  });

  it("should include instructions in formatted handoff", () => {
    const response: AgentResponse = {
      text: "Data",
      steps: [],
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      agentName: "a",
    };

    const handoff = createHandoff("a", "b", response, "Use bullet points");
    const formatted = formatHandoffInput(handoff);

    expect(formatted).toContain("[Instructions: Use bullet points]");
  });
});

// ---------------------------------------------------------------------------
// TeamContext factory tests
// ---------------------------------------------------------------------------

describe("createTeamContext", () => {
  it("should create a context with blackboard and message bus", () => {
    const bb = new Blackboard();
    bb.set("shared", "data");
    const bus = new MessageBus();

    const context = createTeamContext(bb, bus, 1, []);

    expect(context.currentRound).toBe(1);
    expect(context.previousResults).toEqual([]);
    expect(context.blackboard.get("shared")).toBe("data");
  });

  it("should expose sendMessage and getMessages", () => {
    const bb = new Blackboard();
    const bus = new MessageBus();

    const context = createTeamContext(bb, bus, 1, []);

    context.sendMessage("a", "b", "Hello");
    const messages = context.getMessages("b");

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello");
  });

  it("should include previous results", () => {
    const bb = new Blackboard();
    const bus = new MessageBus();
    const prevResults: AgentResponse[] = [
      { text: "Previous", steps: [], toolCalls: [], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, agentName: "prev" },
    ];

    const context = createTeamContext(bb, bus, 2, prevResults);

    expect(context.currentRound).toBe(2);
    expect(context.previousResults).toHaveLength(1);
    expect(context.previousResults[0].text).toBe("Previous");
  });
});
