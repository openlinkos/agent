/**
 * OpenAI-compatible adapter E2E tests — generate, stream, tools, structured output.
 *
 * Tests the OpenAI Chat Completions API protocol adapter with any compatible
 * endpoint. Skipped when OPENAI_API_KEY is not set.
 *
 * Environment variables:
 *   OPENAI_API_KEY   — API key for the OpenAI-compatible endpoint
 *   OPENAI_BASE_URL  — Base URL (default: https://api.openai.com/v1)
 *   OPENAI_MODEL     — Model name (default: gpt-4o-mini)
 */

import { describe, it, expect } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { collectText } from "../../src/stream.js";
import type { ToolDefinition } from "../../src/types.js";

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = process.env.OPENAI_BASE_URL;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

describe.skipIf(!API_KEY)("OpenAI-compatible adapter E2E", () => {
  const provider = new OpenAIProvider();
  const messages = [{ role: "user" as const, content: "Say hello in one word." }];
  const options = {
    modelName: MODEL,
    ...(BASE_URL ? { baseURL: BASE_URL } : {}),
  };

  it("generate returns text", async () => {
    const response = await provider.generate(messages, options);
    expect(response.text).toBeTruthy();
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  }, 30_000);

  it("stream returns text deltas", async () => {
    const stream = await provider.stream(messages, options);
    const text = await collectText(stream);
    expect(text.length).toBeGreaterThan(0);
  }, 30_000);

  it("generateWithTools triggers tool call", async () => {
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
      options,
    );

    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe("get_weather");
  }, 30_000);

  it("structured output via responseFormat", async () => {
    const response = await provider.generate(
      [
        {
          role: "user",
          content:
            "Return a JSON object with fields: name (string), age (number). Use name=Alice, age=30.",
        },
      ],
      {
        ...options,
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
