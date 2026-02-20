/**
 * Integration tests: createModel → generate flow with a mock HTTP server.
 *
 * Spins up a real HTTP server that mimics the OpenAI Chat Completions API
 * so the full provider → fetch → parse pipeline is exercised.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createModel,
  registerProvider,
  clearProviders,
  createOpenAIProvider,
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Mock OpenAI-compatible HTTP server
// ---------------------------------------------------------------------------

let server: http.Server;
let baseURL: string;
let requestLog: Array<{ method: string; url: string; body: unknown }>;

function createMockServer(): Promise<void> {
  return new Promise((resolve) => {
    requestLog = [];
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const parsed = body ? JSON.parse(body) : {};
        requestLog.push({ method: req.method!, url: req.url!, body: parsed });

        if (req.url === "/v1/chat/completions") {
          const hasTools = parsed.tools && parsed.tools.length > 0;

          if (hasTools) {
            // Respond with a tool call
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              id: "chatcmpl-mock-tool",
              choices: [{
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [{
                    id: "tc_001",
                    type: "function",
                    function: {
                      name: parsed.tools[0].function.name,
                      arguments: JSON.stringify({ city: "Tokyo" }),
                    },
                  }],
                },
                finish_reason: "tool_calls",
              }],
              usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 },
            }));
          } else {
            // Standard text response
            const userMsg = parsed.messages?.find((m: { role: string }) => m.role === "user");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              id: "chatcmpl-mock-1",
              choices: [{
                message: {
                  role: "assistant",
                  content: `Mock response to: ${userMsg?.content ?? "unknown"}`,
                },
                finish_reason: "stop",
              }],
              usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
            }));
          }
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
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
// Test suite
// ---------------------------------------------------------------------------

describe("AI Integration: createModel → generate", () => {
  beforeAll(async () => {
    await createMockServer();
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    clearProviders();
    requestLog = [];
  });

  it("should send a request through the full provider pipeline and return parsed response", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-key-123",
    });

    const response = await model.generate([
      { role: "user", content: "Hello, world!" },
    ]);

    expect(response.text).toBe("Mock response to: Hello, world!");
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBe(30);
    expect(response.toolCalls).toHaveLength(0);

    // Verify the actual HTTP request was made correctly
    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe("POST");
    expect(requestLog[0].url).toBe("/v1/chat/completions");
    const reqBody = requestLog[0].body as Record<string, unknown>;
    expect(reqBody.model).toBe("gpt-4o-mock");
  });

  it("should pass model config options to the HTTP request", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-key",
      temperature: 0.5,
      maxTokens: 100,
      topP: 0.9,
    });

    await model.generate([{ role: "user", content: "Test config" }]);

    const reqBody = requestLog[0].body as Record<string, unknown>;
    expect(reqBody.temperature).toBe(0.5);
    expect(reqBody.max_tokens).toBe(100);
    expect(reqBody.top_p).toBe(0.9);
  });

  it("should support generateWithTools through the HTTP pipeline", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-key",
    });

    const response = await model.generateWithTools(
      [{ role: "user", content: "What is the weather?" }],
      [{
        name: "get_weather",
        description: "Get weather data",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      }],
    );

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0].name).toBe("get_weather");
    expect(response.toolCalls[0].arguments).toEqual({ city: "Tokyo" });
    expect(response.finishReason).toBe("tool_calls");
  });

  it("should handle per-call config overrides", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL,
      apiKey: "test-key",
      temperature: 0.5,
    });

    await model.generate(
      [{ role: "user", content: "Override test" }],
      { temperature: 0.9 },
    );

    const reqBody = requestLog[0].body as Record<string, unknown>;
    expect(reqBody.temperature).toBe(0.9);
  });

  it("should propagate HTTP errors as exceptions", async () => {
    registerProvider(createOpenAIProvider());
    const model = createModel("openai:gpt-4o-mock", {
      baseURL: `${baseURL.replace("/v1", "")}/nonexistent`,
      apiKey: "test-key",
    });

    await expect(
      model.generate([{ role: "user", content: "Error test" }]),
    ).rejects.toThrow();
  });
});
