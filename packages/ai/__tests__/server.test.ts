/**
 * Tests for the OpenAI-compatible agent server.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createAgentServer } from "../src/server.js";
import type { ServerAgent, ServerAgentResponse } from "../src/server.js";

// ---------------------------------------------------------------------------
// Mock agent
// ---------------------------------------------------------------------------

function createMockAgent(
  name: string,
  response?: Partial<ServerAgentResponse>,
): ServerAgent {
  return {
    name,
    async run(input: string): Promise<ServerAgentResponse> {
      if (response) {
        return {
          text: response.text ?? `Response to: ${input}`,
          toolCalls: response.toolCalls ?? [],
          usage: response.usage ?? { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      }
      return {
        text: `Response to: ${input}`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  };
}

function createFailingAgent(name: string, error: string): ServerAgent {
  return {
    name,
    async run(): Promise<ServerAgentResponse> {
      throw new Error(error);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postJSON(
  baseURL: string,
  path: string,
  body: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseURL);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: JSON.parse(data),
            });
          } catch {
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: data,
            });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function postSSE(
  baseURL: string,
  path: string,
  body: unknown,
): Promise<{ status: number; chunks: unknown[] }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseURL);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let buffer = "";
        const chunks: unknown[] = [];
        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                chunks.push(JSON.parse(data));
              } catch {
                // skip unparseable
              }
            }
          }
        });
        res.on("end", () => {
          resolve({ status: res.statusCode!, chunks });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAgentServer", () => {
  let server: http.Server;
  let baseURL: string;

  // ---------------------------------------------------------------------------
  // Non-streaming
  // ---------------------------------------------------------------------------

  describe("non-streaming", () => {
    beforeAll(async () => {
      const agent = createMockAgent("test-agent");
      server = createAgentServer(agent);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should return a valid OpenAI chat completion response", async () => {
      const { status, body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test-agent",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(status).toBe(200);
      const data = body as Record<string, unknown>;
      expect(data.object).toBe("chat.completion");
      expect(data.model).toBe("test-agent");
      expect(typeof data.id).toBe("string");
      expect(typeof data.created).toBe("number");
    });

    it("should include the agent response text in choices", async () => {
      const { body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test-agent",
        messages: [{ role: "user", content: "Hello" }],
      });

      const data = body as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, unknown>>;
      expect(choices).toHaveLength(1);

      const message = choices[0].message as Record<string, unknown>;
      expect(message.role).toBe("assistant");
      expect(message.content).toBe("Response to: Hello");
      expect(choices[0].finish_reason).toBe("stop");
    });

    it("should include usage information", async () => {
      const { body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test-agent",
        messages: [{ role: "user", content: "Hi" }],
      });

      const data = body as Record<string, unknown>;
      const usage = data.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
      expect(usage.total_tokens).toBe(15);
    });

    it("should extract the last user message", async () => {
      const { body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test-agent",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "First" },
          { role: "assistant", content: "OK" },
          { role: "user", content: "Second" },
        ],
      });

      const data = body as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, unknown>>;
      const message = choices[0].message as Record<string, unknown>;
      expect(message.content).toBe("Response to: Second");
    });
  });

  // ---------------------------------------------------------------------------
  // Request parsing
  // ---------------------------------------------------------------------------

  describe("request parsing", () => {
    beforeAll(async () => {
      const agent = createMockAgent("parser-agent");
      server = createAgentServer(agent);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should return 404 for unknown routes", async () => {
      const { status, body } = await postJSON(baseURL, "/v1/models", {});
      expect(status).toBe(404);
      const data = body as Record<string, unknown>;
      expect(data.error).toBeDefined();
    });

    it("should return 400 for invalid JSON", async () => {
      const { status } = await new Promise<{ status: number }>((resolve, reject) => {
        const url = new URL("/v1/chat/completions", baseURL);
        const req = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve({ status: res.statusCode! }));
          },
        );
        req.on("error", reject);
        req.write("not json{{{");
        req.end();
      });

      expect(status).toBe(400);
    });

    it("should return 400 when messages is missing", async () => {
      const { status, body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test",
      });
      expect(status).toBe(400);
      const data = body as Record<string, unknown>;
      const error = data.error as Record<string, unknown>;
      expect(error.message).toContain("messages");
    });

    it("should return 400 when messages is empty", async () => {
      const { status } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "test",
        messages: [],
      });
      expect(status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Tool calls in response
  // ---------------------------------------------------------------------------

  describe("tool calls", () => {
    beforeAll(async () => {
      const agent = createMockAgent("tool-agent", {
        text: "",
        toolCalls: [
          {
            id: "tc_001",
            name: "get_weather",
            arguments: { city: "Tokyo" },
          },
        ],
      });
      server = createAgentServer(agent, {
        tools: [
          {
            name: "get_weather",
            description: "Get weather for a city",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        ],
      });
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should return tool calls in OpenAI format", async () => {
      const { body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "tool-agent",
        messages: [{ role: "user", content: "Weather in Tokyo" }],
      });

      const data = body as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe("tool_calls");

      const message = choices[0].message as Record<string, unknown>;
      const toolCalls = message.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe("tc_001");
      expect(toolCalls[0].type).toBe("function");

      const fn = toolCalls[0].function as Record<string, string>;
      expect(fn.name).toBe("get_weather");
      expect(JSON.parse(fn.arguments)).toEqual({ city: "Tokyo" });
    });

    it("should include tools in response when configured", async () => {
      const { body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "tool-agent",
        messages: [{ role: "user", content: "test" }],
      });

      const data = body as Record<string, unknown>;
      const tools = data.tools as Array<Record<string, unknown>>;
      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe("function");

      const fn = tools[0].function as Record<string, unknown>;
      expect(fn.name).toBe("get_weather");
    });
  });

  // ---------------------------------------------------------------------------
  // Streaming
  // ---------------------------------------------------------------------------

  describe("streaming", () => {
    beforeAll(async () => {
      const agent = createMockAgent("stream-agent", {
        text: "Hello World",
      });
      server = createAgentServer(agent);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should return SSE chunks for streaming requests", async () => {
      const { status, chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-agent",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      expect(status).toBe(200);
      expect(chunks.length).toBeGreaterThan(0);

      // First chunk should have role
      const first = chunks[0] as Record<string, unknown>;
      expect(first.object).toBe("chat.completion.chunk");
      const firstChoices = first.choices as Array<Record<string, unknown>>;
      const firstDelta = firstChoices[0].delta as Record<string, unknown>;
      expect(firstDelta.role).toBe("assistant");
    });

    it("should include content deltas in streaming chunks", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-agent",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      // Collect all content from delta chunks
      let fullContent = "";
      for (const chunk of chunks) {
        const c = chunk as Record<string, unknown>;
        const choices = c.choices as Array<Record<string, unknown>>;
        const delta = choices[0].delta as Record<string, unknown>;
        if (typeof delta.content === "string") {
          fullContent += delta.content;
        }
      }
      expect(fullContent).toBe("Hello World");
    });

    it("should end with a finish_reason chunk", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-agent",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      const last = chunks[chunks.length - 1] as Record<string, unknown>;
      const choices = last.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe("stop");
    });

    it("should include usage in the final chunk", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-agent",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      const last = chunks[chunks.length - 1] as Record<string, unknown>;
      const usage = last.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBe(10);
      expect(usage.completion_tokens).toBe(5);
      expect(usage.total_tokens).toBe(15);
    });

    it("should use chat.completion.chunk as object type", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-agent",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      for (const chunk of chunks) {
        const c = chunk as Record<string, unknown>;
        expect(c.object).toBe("chat.completion.chunk");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Streaming with tool calls
  // ---------------------------------------------------------------------------

  describe("streaming with tool calls", () => {
    beforeAll(async () => {
      const agent = createMockAgent("stream-tool-agent", {
        text: "",
        toolCalls: [
          {
            id: "tc_stream_001",
            name: "search",
            arguments: { query: "test" },
          },
        ],
      });
      server = createAgentServer(agent);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should stream tool call deltas", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-tool-agent",
        messages: [{ role: "user", content: "search" }],
        stream: true,
      });

      // Find tool_calls in delta
      let foundToolCall = false;
      for (const chunk of chunks) {
        const c = chunk as Record<string, unknown>;
        const choices = c.choices as Array<Record<string, unknown>>;
        const delta = choices[0].delta as Record<string, unknown>;
        if (delta.tool_calls) {
          foundToolCall = true;
          const tcs = delta.tool_calls as Array<Record<string, unknown>>;
          expect(tcs[0].id).toBe("tc_stream_001");
          const fn = tcs[0].function as Record<string, unknown>;
          expect(fn.name).toBe("search");
        }
      }
      expect(foundToolCall).toBe(true);
    });

    it("should end streaming with tool_calls finish reason", async () => {
      const { chunks } = await postSSE(baseURL, "/v1/chat/completions", {
        model: "stream-tool-agent",
        messages: [{ role: "user", content: "search" }],
        stream: true,
      });

      const last = chunks[chunks.length - 1] as Record<string, unknown>;
      const choices = last.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe("tool_calls");
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    beforeAll(async () => {
      const agent = createFailingAgent("error-agent", "Agent exploded");
      server = createAgentServer(agent);
      await new Promise<void>((resolve) => {
        server.listen(0, () => {
          const addr = server.address() as AddressInfo;
          baseURL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("should return 500 with error message when agent throws", async () => {
      const { status, body } = await postJSON(baseURL, "/v1/chat/completions", {
        model: "error-agent",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(status).toBe(500);
      const data = body as Record<string, unknown>;
      const error = data.error as Record<string, unknown>;
      expect(error.message).toBe("Agent exploded");
      expect(error.type).toBe("server_error");
    });
  });

  // ---------------------------------------------------------------------------
  // Server creation
  // ---------------------------------------------------------------------------

  describe("server creation", () => {
    it("should return an http.Server instance", () => {
      const agent = createMockAgent("check");
      const srv = createAgentServer(agent);
      expect(srv).toBeInstanceOf(http.Server);
    });
  });
});
