/**
 * OpenAI-compatible adapter E2E tests — generate, stream, tools, structured output.
 *
 * Tests the OpenAI Chat Completions API protocol adapter with any compatible
 * endpoint. Skipped when OPENAI_API_KEY is not set (unless MOCK=true).
 *
 * Environment variables:
 *   OPENAI_API_KEY   — API key for the OpenAI-compatible endpoint
 *   OPENAI_BASE_URL  — Base URL (default: https://api.openai.com/v1)
 *   OPENAI_MODEL     — Model name (default: gpt-4o-mini)
 *   MOCK             — Set to "true" to use a mock server (no real API needed)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { collectText } from "../../src/stream.js";
import type { ToolDefinition } from "../../src/types.js";
import { createMockOpenAI } from "../helpers/mock-openai-server.js";
import type { MockOpenAI } from "../helpers/mock-openai-server.js";

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const USE_MOCK = process.env.MOCK === "true";

const HAS_PROVIDER = !!(API_KEY || USE_MOCK);

describe.skipIf(!HAS_PROVIDER)("OpenAI-compatible adapter E2E", () => {
  let mockServer: MockOpenAI | null = null;
  let baseURL = BASE_URL;
  let apiKey = API_KEY ?? "";
  let model = MODEL;

  beforeAll(async () => {
    if (USE_MOCK) {
      mockServer = await createMockOpenAI();
      baseURL = mockServer.url;
      apiKey = "mock-key";
      model = "mock-model";
    }
  }, 30_000);

  afterAll(() => {
    mockServer?.close();
  });

  const getProvider = () => new OpenAIProvider();
  const getOptions = () => ({
    modelName: model,
    ...(baseURL ? { baseURL } : {}),
  });

  it("generate returns text", async () => {
    const provider = getProvider();
    const response = await provider.generate(
      [{ role: "user" as const, content: "Say hello in one word." }],
      { ...getOptions(), apiKey },
    );
    expect(response.text).toBeTruthy();
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  }, 30_000);

  it("stream returns text deltas", async () => {
    const provider = getProvider();
    const stream = await provider.stream(
      [{ role: "user" as const, content: "Say hello in one word." }],
      { ...getOptions(), apiKey },
    );
    const text = await collectText(stream);
    expect(text.length).toBeGreaterThan(0);
  }, 30_000);

  it("generateWithTools triggers tool call", async () => {
    const provider = getProvider();
    const tools: ToolDefinition[] = [
      {
        name: "get_weather",
        description: "Get weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    ];

    const response = await provider.generateWithTools(
      [{ role: "user", content: "What is the weather in Paris? Use the tool." }],
      tools,
      { ...getOptions(), apiKey },
    );

    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe("get_weather");
  }, 30_000);

  it("structured output via responseFormat", async () => {
    const provider = getProvider();
    const response = await provider.generate(
      [
        {
          role: "user",
          content:
            "Return a JSON object with fields: name (string), age (number). Use name=Alice, age=30.",
        },
      ],
      {
        ...getOptions(),
        apiKey,
        responseFormat: {
          type: "json",
          schema: {
            type: "object",
            properties: { name: { type: "string" }, age: { type: "number" } },
            required: ["name", "age"],
          },
        },
      },
    );

    const parsed = JSON.parse(response.text!);
    expect(parsed.name).toBe("Alice");
    expect(parsed.age).toBe(30);
  }, 30_000);
});
