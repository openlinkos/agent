/**
 * Anthropic-compatible adapter E2E tests — generate, stream, tools.
 *
 * Tests the Anthropic Messages API protocol adapter with any compatible
 * endpoint. Skipped when ANTHROPIC_API_KEY is not set.
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY   — API key for the Anthropic-compatible endpoint
 *   ANTHROPIC_BASE_URL  — Base URL (default: https://api.anthropic.com)
 *   ANTHROPIC_MODEL     — Model name (default: claude-sonnet-4-20250514)
 */

import { describe, it, expect } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic.js";
import { collectText } from "../../src/stream.js";
import type { ToolDefinition } from "../../src/types.js";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const BASE_URL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

describe.skipIf(!API_KEY)("Anthropic-compatible adapter E2E", () => {
  const provider = new AnthropicProvider();
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
      [
        {
          role: "user",
          content: "What is the weather in Paris? Use the get_weather tool.",
        },
      ],
      tools,
      options,
    );

    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe("get_weather");
  }, 30_000);
});
