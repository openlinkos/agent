/**
 * Tests for advanced streaming utilities.
 */

import { describe, it, expect } from "vitest";
import {
  backpressureStream,
  bufferUntil,
  textTransform,
  mergeStreams,
} from "../src/stream-utils.js";
import { streamFromArray, collectEvents, collectText, createStream } from "../src/stream.js";
import type { StreamEvent } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a stream that yields events with configurable delays. */
function delayedStream(events: StreamEvent[], delayMs: number): import("../src/stream.js").StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        await new Promise((r) => setTimeout(r, delayMs));
        yield event;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// backpressureStream
// ---------------------------------------------------------------------------

describe("backpressureStream", () => {
  it("should forward all events from the source", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
      { type: "text_delta", text: "c" },
      { type: "done" },
    ];

    const stream = backpressureStream(streamFromArray(events), 2);
    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });

  it("should handle a high-water mark of 1", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "x" },
      { type: "text_delta", text: "y" },
      { type: "done" },
    ];

    const stream = backpressureStream(streamFromArray(events), 1);
    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });

  it("should handle an empty stream", async () => {
    const stream = backpressureStream(streamFromArray([]), 5);
    const collected = await collectEvents(stream);
    expect(collected).toEqual([]);
  });

  it("should pause upstream when buffer is full", async () => {
    const yielded: string[] = [];

    const source = createStream({
      async *[Symbol.asyncIterator]() {
        for (const ch of ["a", "b", "c", "d"]) {
          yielded.push(ch);
          yield { type: "text_delta" as const, text: ch };
        }
      },
    });

    const stream = backpressureStream(source, 2);
    const collected = await collectEvents(stream);

    expect(collected).toHaveLength(4);
    expect(yielded).toEqual(["a", "b", "c", "d"]);
  });

  it("should propagate errors from upstream", async () => {
    const source = createStream({
      async *[Symbol.asyncIterator]() {
        yield { type: "text_delta" as const, text: "ok" };
        throw new Error("upstream failure");
      },
    });

    const stream = backpressureStream(source, 5);
    await expect(collectEvents(stream)).rejects.toThrow("upstream failure");
  });

  it("should work with large number of events", async () => {
    const events: StreamEvent[] = [];
    for (let i = 0; i < 100; i++) {
      events.push({ type: "text_delta", text: String(i) });
    }
    events.push({ type: "done" });

    const stream = backpressureStream(streamFromArray(events), 10);
    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });
});

// ---------------------------------------------------------------------------
// bufferUntil
// ---------------------------------------------------------------------------

describe("bufferUntil", () => {
  it("should buffer events until predicate returns true", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
      { type: "text_delta", text: "FLUSH" },
      { type: "text_delta", text: "c" },
      { type: "done" },
    ];

    const collected: StreamEvent[] = [];
    const stream = bufferUntil(
      streamFromArray(events),
      (e) => e.type === "text_delta" && e.text === "FLUSH",
    );

    for await (const event of stream) {
      collected.push(event);
    }

    // All events should eventually arrive.
    expect(collected).toEqual(events);
  });

  it("should flush all buffered events when predicate matches", async () => {
    const order: string[] = [];

    const events: StreamEvent[] = [
      { type: "text_delta", text: "1" },
      { type: "text_delta", text: "2" },
      { type: "text_delta", text: "3" }, // predicate matches here
      { type: "text_delta", text: "4" },
      { type: "done" },
    ];

    const stream = bufferUntil(
      streamFromArray(events),
      (e) => e.type === "text_delta" && e.text === "3",
    );

    for await (const event of stream) {
      if (event.type === "text_delta") {
        order.push(event.text);
      }
    }

    expect(order).toEqual(["1", "2", "3", "4"]);
  });

  it("should pass through events immediately after flush", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "buffered" },
      { type: "done" }, // predicate matches on "done"
      { type: "text_delta", text: "passthrough" },
    ];

    // Use a source that can yield after done (unusual, but tests the passthrough path)
    const source = createStream({
      async *[Symbol.asyncIterator]() {
        for (const event of events) {
          yield event;
        }
      },
    });

    const stream = bufferUntil(source, (e) => e.type === "done");
    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });

  it("should flush remaining buffer if predicate never matches", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
    ];

    const stream = bufferUntil(
      streamFromArray(events),
      () => false, // never matches
    );

    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });

  it("should handle empty stream", async () => {
    const stream = bufferUntil(streamFromArray([]), () => true);
    const collected = await collectEvents(stream);
    expect(collected).toEqual([]);
  });

  it("should handle predicate matching on first event", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "first" },
      { type: "text_delta", text: "second" },
      { type: "done" },
    ];

    const stream = bufferUntil(streamFromArray(events), () => true);
    const collected = await collectEvents(stream);
    expect(collected).toEqual(events);
  });
});

// ---------------------------------------------------------------------------
// textTransform
// ---------------------------------------------------------------------------

describe("textTransform", () => {
  it("should transform text_delta events", async () => {
    const stream = streamFromArray([
      { type: "text_delta", text: "hello" },
      { type: "text_delta", text: "world" },
      { type: "done" },
    ]);

    const transformed = textTransform(stream, (t) => t.toUpperCase());
    const text = await collectText(transformed);
    expect(text).toBe("HELLOWORLD");
  });

  it("should leave non-text events unchanged", async () => {
    const usage = { promptTokens: 5, completionTokens: 3, totalTokens: 8 };
    const events: StreamEvent[] = [
      { type: "text_delta", text: "hi" },
      { type: "usage", usage },
      { type: "done" },
    ];

    const stream = textTransform(streamFromArray(events), (t) => t.toUpperCase());
    const collected = await collectEvents(stream);

    expect(collected[0]).toEqual({ type: "text_delta", text: "HI" });
    expect(collected[1]).toEqual({ type: "usage", usage });
    expect(collected[2]).toEqual({ type: "done" });
  });

  it("should handle empty text", async () => {
    const stream = textTransform(
      streamFromArray([{ type: "text_delta", text: "" }, { type: "done" }]),
      (t) => `[${t}]`,
    );

    const collected = await collectEvents(stream);
    expect(collected[0]).toEqual({ type: "text_delta", text: "[]" });
  });

  it("should handle stream with no text events", async () => {
    const events: StreamEvent[] = [{ type: "done" }];
    const stream = textTransform(streamFromArray(events), (t) => t.toUpperCase());
    const collected = await collectEvents(stream);
    expect(collected).toEqual([{ type: "done" }]);
  });

  it("should support prefix/suffix transforms", async () => {
    const stream = textTransform(
      streamFromArray([
        { type: "text_delta", text: "chunk1" },
        { type: "text_delta", text: "chunk2" },
        { type: "done" },
      ]),
      (t) => `<${t}>`,
    );

    const text = await collectText(stream);
    expect(text).toBe("<chunk1><chunk2>");
  });

  it("should preserve tool_call_delta events", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "before" },
      {
        type: "tool_call_delta",
        toolCall: { id: "tc1", name: "search", arguments: { q: "test" } },
      },
      { type: "text_delta", text: "after" },
      { type: "done" },
    ];

    const stream = textTransform(streamFromArray(events), (t) => t.toUpperCase());
    const collected = await collectEvents(stream);

    expect(collected[0]).toEqual({ type: "text_delta", text: "BEFORE" });
    expect(collected[1]).toEqual({
      type: "tool_call_delta",
      toolCall: { id: "tc1", name: "search", arguments: { q: "test" } },
    });
    expect(collected[2]).toEqual({ type: "text_delta", text: "AFTER" });
    expect(collected[3]).toEqual({ type: "done" });
  });
});

// ---------------------------------------------------------------------------
// mergeStreams
// ---------------------------------------------------------------------------

describe("mergeStreams", () => {
  it("should merge multiple streams into one", async () => {
    const s1 = streamFromArray([
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
    ]);
    const s2 = streamFromArray([
      { type: "text_delta", text: "c" },
      { type: "text_delta", text: "d" },
    ]);

    const merged = mergeStreams([s1, s2]);
    const collected = await collectEvents(merged);

    // All 4 events should be present (order may vary due to interleaving).
    expect(collected).toHaveLength(4);
    const texts = collected.map((e) => (e.type === "text_delta" ? e.text : ""));
    expect(texts.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("should handle an empty array of streams", async () => {
    const merged = mergeStreams([]);
    const collected = await collectEvents(merged);
    expect(collected).toEqual([]);
  });

  it("should handle a single stream", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "only" },
      { type: "done" },
    ];

    const merged = mergeStreams([streamFromArray(events)]);
    const collected = await collectEvents(merged);
    expect(collected).toEqual(events);
  });

  it("should handle streams of different lengths", async () => {
    const s1 = streamFromArray([
      { type: "text_delta", text: "a" },
    ]);
    const s2 = streamFromArray([
      { type: "text_delta", text: "b" },
      { type: "text_delta", text: "c" },
      { type: "text_delta", text: "d" },
    ]);
    const s3 = streamFromArray([
      { type: "text_delta", text: "e" },
      { type: "text_delta", text: "f" },
    ]);

    const merged = mergeStreams([s1, s2, s3]);
    const collected = await collectEvents(merged);
    expect(collected).toHaveLength(6);
  });

  it("should handle streams with empty sources", async () => {
    const s1 = streamFromArray([]);
    const s2 = streamFromArray([{ type: "text_delta", text: "x" }]);
    const s3 = streamFromArray([]);

    const merged = mergeStreams([s1, s2, s3]);
    const collected = await collectEvents(merged);
    expect(collected).toHaveLength(1);
    expect(collected[0]).toEqual({ type: "text_delta", text: "x" });
  });

  it("should propagate errors from any source", async () => {
    const failing = createStream({
      async *[Symbol.asyncIterator]() {
        yield { type: "text_delta" as const, text: "ok" };
        throw new Error("merge source error");
      },
    });
    const good = streamFromArray([{ type: "text_delta", text: "fine" }]);

    const merged = mergeStreams([failing, good]);
    await expect(collectEvents(merged)).rejects.toThrow("merge source error");
  });

  it("should merge three streams preserving all events", async () => {
    const s1 = streamFromArray([
      { type: "text_delta", text: "1a" },
      { type: "text_delta", text: "1b" },
      { type: "done" },
    ]);
    const s2 = streamFromArray([
      { type: "text_delta", text: "2a" },
      { type: "usage", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
    ]);
    const s3 = streamFromArray([
      { type: "text_delta", text: "3a" },
    ]);

    const merged = mergeStreams([s1, s2, s3]);
    const collected = await collectEvents(merged);
    expect(collected).toHaveLength(6);

    const types = collected.map((e) => e.type);
    expect(types.filter((t) => t === "text_delta")).toHaveLength(4);
    expect(types.filter((t) => t === "usage")).toHaveLength(1);
    expect(types.filter((t) => t === "done")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

describe("stream-utils composition", () => {
  it("should compose textTransform with bufferUntil", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "hello" },
      { type: "text_delta", text: " " },
      { type: "text_delta", text: "world" },
      { type: "done" },
    ];

    const stream = textTransform(
      bufferUntil(streamFromArray(events), (e) => e.type === "done"),
      (t) => t.toUpperCase(),
    );

    const text = await collectText(stream);
    expect(text).toBe("HELLO WORLD");
  });

  it("should compose backpressure with textTransform", async () => {
    const events: StreamEvent[] = [
      { type: "text_delta", text: "a" },
      { type: "text_delta", text: "b" },
      { type: "text_delta", text: "c" },
      { type: "done" },
    ];

    const stream = textTransform(
      backpressureStream(streamFromArray(events), 2),
      (t) => t.toUpperCase(),
    );

    const text = await collectText(stream);
    expect(text).toBe("ABC");
  });

  it("should compose mergeStreams with textTransform", async () => {
    const s1 = streamFromArray([{ type: "text_delta", text: "hello" }]);
    const s2 = streamFromArray([{ type: "text_delta", text: "world" }]);

    const stream = textTransform(mergeStreams([s1, s2]), (t) => t.toUpperCase());
    const collected = await collectEvents(stream);

    const texts = collected
      .filter((e): e is import("../src/stream.js").TextDelta => e.type === "text_delta")
      .map((e) => e.text);

    expect(texts.sort()).toEqual(["HELLO", "WORLD"]);
  });
});
