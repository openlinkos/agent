/**
 * Tests for streaming utilities.
 */

import { describe, it, expect, vi } from "vitest";
import {
  streamFromArray,
  mapStream,
  filterStream,
  tapStream,
  collectText,
  collectEvents,
  createStream,
} from "../src/stream.js";
import type { StreamEvent } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamFromArray", () => {
  it("should create a stream from an array of events", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "Hello" },
      { type: "text_delta", text: " world" },
      { type: "done" },
    ];

    const stream = streamFromArray(events);
    const collected: StreamEvent[] = [];

    for await (const event of stream) {
      collected.push(event);
    }

    expect(collected).toEqual(events);
  });

  it("should handle empty array", async () => {
    const stream = streamFromArray([]);
    const collected = await collectEvents(stream);
    expect(collected).toEqual([]);
  });
});

describe("createStream", () => {
  it("should create a stream from an async iterable", async () => {
    const source = {
      async *[Symbol.asyncIterator]() {
        yield { type: "text_delta" as const, text: "test" };
        yield { type: "done" as const };
      },
    };

    const stream = createStream(source);
    const collected = await collectEvents(stream);
    expect(collected).toHaveLength(2);
    expect(collected[0]).toEqual({ type: "text_delta", text: "test" });
  });
});

describe("collectText", () => {
  it("should collect all text deltas into a string", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "Hello" },
      { type: "text_delta", text: ", " },
      { type: "text_delta", text: "world!" },
      { type: "done" },
    ]);

    const text = await collectText(stream);
    expect(text).toBe("Hello, world!");
  });

  it("should ignore non-text events", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "Hello" },
      { type: "usage", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      { type: "text_delta", text: " world" },
      { type: "done" },
    ]);

    const text = await collectText(stream);
    expect(text).toBe("Hello world");
  });

  it("should return empty string for no text events", async () => {
    const stream = streamFromArray([{ type: "done" }]);
    const text = await collectText(stream);
    expect(text).toBe("");
  });
});

describe("collectEvents", () => {
  it("should collect all events into an array", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
      { type: "done" },
    ];
    const stream = streamFromArray(events);
    const result = await collectEvents(stream);
    expect(result).toEqual(events);
  });
});

describe("mapStream", () => {
  it("should transform each event", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "hello" },
      { type: "done" },
    ]);

    const mapped = mapStream(stream, (event) => {
      if (event.type === "text_delta") {
        return { ...event, text: event.text.toUpperCase() };
      }
      return event;
    });

    const collected = await collectEvents(mapped);
    expect(collected[0]).toEqual({ type: "text_delta", text: "HELLO" });
  });
});

describe("filterStream", () => {
  it("should filter out events", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "a" },
      { type: "usage", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      { type: "text_delta", text: "b" },
      { type: "done" },
    ]);

    const filtered = filterStream(stream, (e) => e.type === "text_delta");
    const collected = await collectEvents(filtered);
    expect(collected).toHaveLength(2);
    expect(collected.every((e) => e.type === "text_delta")).toBe(true);
  });

  it("should handle filtering all events", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "a" },
      { type: "done" },
    ]);

    const filtered = filterStream(stream, () => false);
    const collected = await collectEvents(filtered);
    expect(collected).toHaveLength(0);
  });
});

describe("tapStream", () => {
  it("should execute side effect without modifying events", async () => {
    const sideEffects: string[] = [];
    const stream = streamFromArray([
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
      { type: "done" },
    ]);

    const tapped = tapStream(stream, (event) => {
      sideEffects.push(event.type);
    });

    const collected = await collectEvents(tapped);
    expect(collected).toHaveLength(3);
    expect(sideEffects).toEqual(["text_delta", "text_delta", "done"]);
  });
});

describe("stream with tool call deltas", () => {
  it("should stream tool call events", async () => {
    const stream = streamFromArray([
      {
        type: "tool_call_delta",
        toolCall: {
          id: "call_123",
          name: "get_weather",
          arguments: { city: "Tokyo" },
        },
      },
      { type: "done" },
    ]);

    const collected = await collectEvents(stream);
    expect(collected).toHaveLength(2);
    expect(collected[0].type).toBe("tool_call_delta");
    if (collected[0].type === "tool_call_delta") {
      expect(collected[0].toolCall.id).toBe("call_123");
      expect(collected[0].toolCall.name).toBe("get_weather");
    }
  });
});
