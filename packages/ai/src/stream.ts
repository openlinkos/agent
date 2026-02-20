/**
 * Streaming utilities for @openlinkos/ai.
 *
 * Provides an async-iterable StreamResult type with combinators.
 */

import type { ToolCall, Usage } from "./types.js";

// ---------------------------------------------------------------------------
// Stream event types
// ---------------------------------------------------------------------------

/** A chunk of generated text. */
export interface TextDelta {
  type: "text_delta";
  text: string;
}

/** A tool call chunk (may arrive incrementally). */
export interface ToolCallDelta {
  type: "tool_call_delta";
  toolCall: Partial<ToolCall> & { id: string };
}

/** Final usage stats emitted at the end of a stream. */
export interface UsageDelta {
  type: "usage";
  usage: Usage;
}

/** Stream is done. */
export interface StreamDone {
  type: "done";
}

export type StreamEvent = TextDelta | ToolCallDelta | UsageDelta | StreamDone;

// ---------------------------------------------------------------------------
// StreamResult
// ---------------------------------------------------------------------------

/**
 * An async iterable stream of model output events.
 */
export interface StreamResult {
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent>;
}

/**
 * Create a StreamResult from an async iterable of events.
 */
export function createStream(source: AsyncIterable<StreamEvent>): StreamResult {
  return {
    [Symbol.asyncIterator]() {
      return source[Symbol.asyncIterator]();
    },
  };
}

/**
 * Create a StreamResult from an array (useful for testing).
 */
export function streamFromArray(events: StreamEvent[]): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Stream combinators
// ---------------------------------------------------------------------------

/**
 * Map each event in a stream to a new event.
 */
export function mapStream(
  stream: StreamResult,
  fn: (event: StreamEvent) => StreamEvent,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        yield fn(event);
      }
    },
  });
}

/**
 * Filter events in a stream.
 */
export function filterStream(
  stream: StreamResult,
  predicate: (event: StreamEvent) => boolean,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        if (predicate(event)) {
          yield event;
        }
      }
    },
  });
}

/**
 * Execute a side-effect for each event without modifying the stream.
 */
export function tapStream(
  stream: StreamResult,
  fn: (event: StreamEvent) => void,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        fn(event);
        yield event;
      }
    },
  });
}

/**
 * Collect all text deltas from a stream into a single string.
 */
export async function collectText(stream: StreamResult): Promise<string> {
  let text = "";
  for await (const event of stream) {
    if (event.type === "text_delta") {
      text += event.text;
    }
  }
  return text;
}

/**
 * Collect all events from a stream into an array.
 */
export async function collectEvents(stream: StreamResult): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}
