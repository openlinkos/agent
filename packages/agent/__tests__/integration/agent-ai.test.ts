/**
 * Integration tests: agent with real ai package (mock HTTP only).
 *
 * Exercises the full stack: createAgent → createModel → OpenAIProvider → mock HTTP server.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createModel,
  registerProvider,
  clearProviders,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Mock HTTP server with stateful conversation tracking
// ---------------------------------------------------------------------------

let server: http.Server;
let baseURL: string;
let callCount: number;

/** Response sequences keyed by scenario. */
const scenarios: Record<string, Array<Record<string, unknown>>> = {
  simple: [
    {
      id: "cmpl-1",
      choices: [{
        message: { role: "assistant", content: "I am an AI assistant. How can I help you today?" },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
    },
  ],
  "tool-use": [
    // First call: request tool
    {
      id: "cmpl-2a",
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "tc_1",
            type: "function",
            function: { name: "calculate", arguments: JSON.stringify({ expression: "2+2" }) },
          }],
        },
        finish_reason: "tool_calls",
      }],
      usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 },
    },
    // Second call: final answer
    {
      id: "cmpl-2b",
      choices: [{
        message: { role: "assistant", content: "The result of 2+2 is 4." },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
    },
  ],
};

let activeScenario = "simple";

function createMockAPIServer(): Promise<void> {
  return new Promise((resolve) => {
    callCount = 0;
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        if (req.url === "/v1/chat/completions") {
          const seq = scenarios[activeScenario];
          const idx = Math.min(callCount, seq.length - 1);
          callCount++;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(seq[idx]));
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

describe("Agent Integration: agent with real AI package", () => {
  beforeAll(async () => {
    await createMockAPIServer();
  });

  afterAll(() => {
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    clearProviders();
    registerProvider(createOpenAIProvider());
    callCount = 0;
    activeScenario = "simple";
  });

  it("should run a simple agent through the full HTTP pipeline", async () => {
    const model = createModel("openai:gpt-4o", { baseURL, apiKey: "test-key" });
    const agent = createAgent({
      name: "simple-integration-agent",
      model,
      systemPrompt: "You are a helpful assistant.",
    });

    const response = await agent.run("Who are you?");

    expect(response.text).toBe("I am an AI assistant. How can I help you today?");
    expect(response.agentName).toBe("simple-integration-agent");
    expect(response.steps).toHaveLength(1);
    expect(response.usage.totalTokens).toBe(35);
  });

  it("should run the full tool-calling ReAct loop through HTTP", async () => {
    activeScenario = "tool-use";

    const model = createModel("openai:gpt-4o", { baseURL, apiKey: "test-key" });
    const agent = createAgent({
      name: "tool-integration-agent",
      model,
      systemPrompt: "You are a calculator assistant.",
      tools: [{
        name: "calculate",
        description: "Evaluate a math expression",
        parameters: {
          type: "object",
          properties: { expression: { type: "string" } },
          required: ["expression"],
        },
        execute: async (params) => {
          const expr = params.expression as string;
          // Simple eval for test
          if (expr === "2+2") return { result: 4 };
          return { result: 0 };
        },
      }],
    });

    const response = await agent.run("What is 2+2?");

    expect(response.text).toBe("The result of 2+2 is 4.");
    expect(response.steps).toHaveLength(2);
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0].name).toBe("calculate");
    expect(response.usage.totalTokens).toBe(90);
  });
});
