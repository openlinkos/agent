/**
 * Agent ReAct loop E2E test — full reasoning cycle with a real LLM.
 *
 * Verifies that createAgent can run a complete ReAct loop: the model
 * receives a question, invokes a tool, receives the tool result, and
 * produces a final text answer.
 *
 * Skipped when OPENAI_API_KEY is not set (uses OpenAI-compatible adapter),
 * unless MOCK=true.
 * Falls back to ANTHROPIC_API_KEY if OPENAI_API_KEY is unavailable.
 *
 * Environment variables (OpenAI-compatible):
 *   OPENAI_API_KEY   — API key
 *   OPENAI_BASE_URL  — Base URL
 *   OPENAI_MODEL     — Model name
 *
 * Environment variables (Anthropic-compatible):
 *   ANTHROPIC_API_KEY   — API key
 *   ANTHROPIC_BASE_URL  — Base URL
 *   ANTHROPIC_MODEL     — Model name
 *
 *   MOCK — Set to "true" to use a mock server (no real API needed)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  registerProvider,
  createModel,
  createOpenAIProvider,
  createAnthropicProvider,
  clearProviders,
} from "@openlinkos/ai";
import { createAgent } from "../../src/index.js";
import type { ToolDefinition } from "../../src/types.js";
import { createMockOpenAI } from "../helpers/mock-openai-server.js";
import type { MockOpenAI } from "../helpers/mock-openai-server.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const USE_MOCK = process.env.MOCK === "true";
const HAS_PROVIDER = !!(OPENAI_KEY || ANTHROPIC_KEY || USE_MOCK);

describe.skipIf(!HAS_PROVIDER)("Agent ReAct loop E2E", () => {
  let mockServer: MockOpenAI | null = null;

  beforeAll(async () => {
    if (USE_MOCK) {
      mockServer = await createMockOpenAI();
    }
  }, 30_000);

  afterAll(() => {
    mockServer?.close();
  });

  function setupModel() {
    clearProviders();
    if (USE_MOCK && mockServer) {
      registerProvider(createOpenAIProvider());
      return createModel("openai:mock-model", {
        baseURL: mockServer.url,
        apiKey: "mock-key",
      });
    }
    if (OPENAI_KEY) {
      registerProvider(createOpenAIProvider());
      const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      return createModel(`openai:${modelName}`, {
        ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
      });
    }
    registerProvider(createAnthropicProvider());
    const modelName = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    return createModel(`anthropic:${modelName}`, {
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });
  }

  it("completes a full ReAct cycle: question → tool call → answer", async () => {
    const model = setupModel();

    const tools: ToolDefinition[] = [
      {
        name: "get_weather",
        description: "Get the current weather for a given city. Returns temperature in Celsius.",
        parameters: {
          type: "object",
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
        execute: async (params) => ({ city: params.city, temp_c: 22, condition: "sunny" }),
      },
    ];

    const agent = createAgent({
      name: "weather-agent",
      model,
      systemPrompt:
        "You are a weather assistant. Use the get_weather tool to answer weather questions. Always use the tool before answering.",
      tools,
      maxIterations: 5,
    });

    const response = await agent.run("What is the weather in Tokyo?");

    // The agent should have produced a final text response
    expect(response.text).toBeTruthy();
    expect(response.text.toLowerCase()).toMatch(/tokyo|22|sunny/);

    // At least one tool call should have been made
    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe("get_weather");

    // Steps should include both the model reasoning and tool execution
    expect(response.steps.length).toBeGreaterThan(0);

    // Usage should be tracked
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  }, 30_000);
});
