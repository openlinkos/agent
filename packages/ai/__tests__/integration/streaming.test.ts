/**
 * Integration tests: streaming end-to-end through createModel.
 *
 * Uses a mock HTTP server that sends SSE (Server-Sent Events) data
 * matching the OpenAI streaming format.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createModel,
  registerProvider,
  clearProviders,
  createOpenAIProvider,
  collectText,
  collectEvents,
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Mock streaming SSE server
// ---------------------------------------------------------------------------

let server: http.Server;
let baseURL: string;

function createSSEServer(): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        if (req.url === "/v1/chat/completions") {
          const parsed = JSON.parse(body);

          if (parsed.stream) {
            // Send SSE streaming response
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });

            const chunks = [
              { choices: [{ delta: { role: "assistant" }, finish_reason: null }] },
              { choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
              { choices: [{ delta: { content: ", " }, finish_reason: null }] },
              { choices: [{ delta: { content: "world" }, finish_reason: null }] },
              { choices: [{ delta: { content: "!" }, finish_reason: null }] },
              { choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } },
            ];

            let i = 0;
            const interval = setInterval(() => {
              if (i < chunks.length) {
                res.write(`data: ${JSON.stringify(chunks[i])}\n\n`);
                i++;
              } else {
                res.write("data: [DONE]\n\n");
                clearInterval(interval);
                res.end();
              }
            }, 5);
          } else {
            // Non-streaming fallback
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              id: "cmpl-1",
              choices: [{
                message: { role: "assistant", content: "Non-streaming response" },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseURL = `http://127.0.0.1:${addr.port}/v1`;
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Integration: Streaming E2E", () => {
  beforeAll(async () => {
    await createSSEServer();
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    clearProviders();
  });

  it("should stream text deltas through createModel.stream()", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-stream-key",
    });

    const streamResult = await model.stream([
      { role: "user", content: "Say hello" },
    ]);

    const text = await collectText(streamResult);
    expect(text).toBe("Hello, world!");
  });

  it("should emit all expected event types during streaming", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-stream-key",
    });

    const streamResult = await model.stream([
      { role: "user", content: "Stream events" },
    ]);

    const events = await collectEvents(streamResult);

    // Should have text_delta events and a done event
    const textDeltas = events.filter((e) => e.type === "text_delta");
    expect(textDeltas.length).toBeGreaterThanOrEqual(1);

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
  });

  it("should collect partial text chunks into the full message", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-stream-key",
    });

    const streamResult = await model.stream([
      { role: "user", content: "Chunked message" },
    ]);

    const chunks: string[] = [];
    for await (const event of streamResult) {
      if (event.type === "text_delta") {
        chunks.push(event.text);
      }
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe("Hello, world!");
  });
});
