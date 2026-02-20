/**
 * Advanced streaming utilities for @openlinkos/ai.
 *
 * Provides backpressure handling, buffering, text transforms, and stream
 * merging on top of the core StreamResult async-iterable primitive.
 */

import type { StreamEvent, StreamResult } from "./stream.js";
import { createStream } from "./stream.js";

// ---------------------------------------------------------------------------
// backpressureStream
// ---------------------------------------------------------------------------

/**
 * Wrap a stream with backpressure support.
 *
 * When the internal buffer reaches `highWaterMark` un-consumed events the
 * upstream producer is paused until the consumer catches up.
 *
 * @param stream - The source stream.
 * @param highWaterMark - Maximum number of buffered events before pausing upstream.
 * @returns A new StreamResult with backpressure applied.
 */
export function backpressureStream(
  stream: StreamResult,
  highWaterMark: number,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      const buffer: StreamEvent[] = [];
      let producerResume: (() => void) | undefined;
      let done = false;
      let error: unknown = null;
      let consumerWake: (() => void) | undefined;

      function wakeConsumer(): void {
        const fn = consumerWake;
        consumerWake = undefined;
        fn?.();
      }

      function resumeProducer(): void {
        const fn = producerResume;
        producerResume = undefined;
        fn?.();
      }

      // Producer: read from upstream into the buffer.
      const producer = (async () => {
        try {
          for await (const event of stream) {
            buffer.push(event);
            wakeConsumer();
            // If buffer is at or above the high-water mark, pause.
            if (buffer.length >= highWaterMark) {
              await new Promise<void>((r) => {
                producerResume = r;
              });
            }
          }
        } catch (err) {
          error = err;
        } finally {
          done = true;
          wakeConsumer();
        }
      })();

      try {
        while (true) {
          // Wait for data when the buffer is empty.
          if (buffer.length === 0 && !done) {
            await new Promise<void>((r) => {
              consumerWake = r;
            });
          }

          // Drain available events.
          while (buffer.length > 0) {
            yield buffer.shift()!;
            resumeProducer();
          }

          if (done) {
            if (error) throw error;
            break;
          }
        }
      } finally {
        // Ensure the producer finishes even if the consumer aborts early.
        await producer;
      }
    },
  });
}

// ---------------------------------------------------------------------------
// bufferUntil
// ---------------------------------------------------------------------------

/**
 * Buffer stream events until a predicate returns `true`, then flush all
 * buffered events (including the event that matched) at once.
 *
 * After the predicate fires, subsequent events pass through immediately.
 *
 * @param stream - The source stream.
 * @param predicate - Called for each event; when it returns `true` the buffer is flushed.
 * @returns A new StreamResult with buffering applied.
 */
export function bufferUntil(
  stream: StreamResult,
  predicate: (event: StreamEvent) => boolean,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      const buffer: StreamEvent[] = [];
      let flushed = false;

      for await (const event of stream) {
        if (flushed) {
          yield event;
          continue;
        }

        buffer.push(event);

        if (predicate(event)) {
          flushed = true;
          for (const buffered of buffer) {
            yield buffered;
          }
        }
      }

      // If the stream ends without the predicate ever returning true,
      // flush whatever we have so no data is lost.
      if (!flushed) {
        for (const buffered of buffer) {
          yield buffered;
        }
      }
    },
  });
}

// ---------------------------------------------------------------------------
// textTransform
// ---------------------------------------------------------------------------

/**
 * Apply a synchronous text transformation to every `text_delta` chunk.
 *
 * Non-text events pass through unchanged.
 *
 * @param stream - The source stream.
 * @param fn - A function that receives the text string and returns a new string.
 * @returns A new StreamResult with the transform applied.
 */
export function textTransform(
  stream: StreamResult,
  fn: (text: string) => string,
): StreamResult {
  return createStream({
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        if (event.type === "text_delta") {
          yield { type: "text_delta" as const, text: fn(event.text) };
        } else {
          yield event;
        }
      }
    },
  });
}

// ---------------------------------------------------------------------------
// mergeStreams
// ---------------------------------------------------------------------------

/**
 * Merge multiple streams into a single stream.
 *
 * Events are interleaved in arrival order — whichever source yields first
 * is forwarded first.  The merged stream completes when **all** sources
 * have completed.
 *
 * @param streams - An array of StreamResult sources.
 * @returns A single merged StreamResult.
 */
export function mergeStreams(streams: StreamResult[]): StreamResult {
  if (streams.length === 0) {
    return createStream({
      async *[Symbol.asyncIterator]() {
        /* empty */
      },
    });
  }

  if (streams.length === 1) {
    return streams[0];
  }

  return createStream({
    async *[Symbol.asyncIterator]() {
      // We use a shared queue + promise chain so that whichever source
      // yields first gets forwarded first.
      const queue: StreamEvent[] = [];
      let consumerWake: (() => void) | undefined;
      let activeCount = streams.length;
      let producerError: unknown = null;

      function wake(): void {
        const fn = consumerWake;
        consumerWake = undefined;
        fn?.();
      }

      const enqueue = (event: StreamEvent) => {
        queue.push(event);
        wake();
      };

      const markDone = () => {
        activeCount--;
        wake();
      };

      // Launch a producer for each source.
      const producers = streams.map(async (s) => {
        try {
          for await (const event of s) {
            enqueue(event);
          }
        } catch (err) {
          producerError = err;
        } finally {
          markDone();
        }
      });

      try {
        while (true) {
          if (queue.length === 0 && activeCount > 0) {
            await new Promise<void>((r) => {
              consumerWake = r;
            });
          }

          while (queue.length > 0) {
            yield queue.shift()!;
          }

          if (producerError) throw producerError;
          if (activeCount === 0 && queue.length === 0) break;
        }
      } finally {
        await Promise.all(producers);
      }
    },
  });
}
