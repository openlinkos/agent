/**
 * Agent tool-calling E2E test — tool call + result verification.
 *
 * Verifies that the agent correctly invokes tools with the right parameters,
 * receives results, and incorporates them into the final response.
 *
 * Skipped when OPENAI_API_KEY is not set (uses OpenAI-compatible adapter).
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
 */

import { describe, it, expect } from "vitest";
import {
  registerProvider,
  createModel,
  createOpenAIProvider,
  createAnthropicProvider,
  clearProviders,
} from "@openlinkos/ai";
import { createAgent } from "../../src/index.js";
import type { ToolDefinition } from "../../src/types.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const HAS_PROVIDER = !!(OPENAI_KEY || ANTHROPIC_KEY);

function setupModel() {
  clearProviders();
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

describe.skipIf(!HAS_PROVIDER)("Agent tool-calling E2E", () => {
  it("passes correct parameters to tool and uses result", async () => {
    const model = setupModel();
    let receivedParams: Record<string, unknown> | undefined;

    const tools: ToolDefinition[] = [
      {
        name: "calculate",
        description:
          "Calculate the result of a mathematical expression. Accepts two numbers and an operator.",
        parameters: {
          type: "object",
          properties: {
            a: { type: "number", description: "First operand" },
            b: { type: "number", description: "Second operand" },
            operator: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
              description: "The arithmetic operator",
            },
          },
          required: ["a", "b", "operator"],
        },
        execute: async (params) => {
          receivedParams = params;
          const a = params.a as number;
          const b = params.b as number;
          const op = params.operator as string;
          switch (op) {
            case "add":
              return { result: a + b };
            case "subtract":
              return { result: a - b };
            case "multiply":
              return { result: a * b };
            case "divide":
              return { result: a / b };
            default:
              return { error: "Unknown operator" };
          }
        },
      },
    ];

    const agent = createAgent({
      name: "calc-agent",
      model,
      systemPrompt:
        "You are a calculator assistant. Use the calculate tool to perform arithmetic. Always use the tool, do not calculate yourself.",
      tools,
      maxIterations: 5,
    });

    const response = await agent.run("What is 7 multiplied by 6?");

    // The tool should have been called with correct parameters
    expect(receivedParams).toBeDefined();
    expect(receivedParams!.a).toBe(7);
    expect(receivedParams!.b).toBe(6);
    expect(receivedParams!.operator).toBe("multiply");

    // The final response should contain the result
    expect(response.text).toBeTruthy();
    expect(response.text).toContain("42");

    // Verify tool call metadata
    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe("calculate");
  }, 30_000);

  it("handles multiple tool calls in sequence", async () => {
    const model = setupModel();
    const callLog: string[] = [];

    const tools: ToolDefinition[] = [
      {
        name: "get_population",
        description: "Get the population of a city.",
        parameters: {
          type: "object",
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
        execute: async (params) => {
          callLog.push(`get_population:${params.city}`);
          const data: Record<string, number> = {
            Tokyo: 14_000_000,
            London: 9_000_000,
          };
          const city = params.city as string;
          return { city, population: data[city] ?? 0 };
        },
      },
    ];

    const agent = createAgent({
      name: "population-agent",
      model,
      systemPrompt:
        "You are a demographics assistant. Use the get_population tool to look up city populations. Call the tool once for each city requested.",
      tools,
      maxIterations: 10,
    });

    const response = await agent.run(
      "What are the populations of Tokyo and London? Look up each city.",
    );

    // Both cities should have been looked up
    expect(callLog).toContain("get_population:Tokyo");
    expect(callLog).toContain("get_population:London");

    // The response should mention both populations
    expect(response.text).toBeTruthy();
    expect(response.text).toMatch(/14[,.]?000[,.]?000/);
    expect(response.text).toMatch(/9[,.]?000[,.]?000/);
  }, 30_000);
});
