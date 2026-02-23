/**
 * 03 - Tool Calling
 *
 * An agent equipped with a calculator and a (simulated) weather tool.
 * Demonstrates: createAgent, ToolDefinition, ReAct reasoning loop,
 * onToolCall / onToolResult hooks.
 *
 * Run: npx tsx examples/03-tool-calling/index.ts
 */

import "dotenv/config";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/03-tool-calling/index.ts\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/** Safe math expression evaluator using Function constructor. */
function evalExpression(expression: string): number {
  // Only allow safe characters: digits, operators, parentheses, spaces, dots
  if (!/^[\d\s\+\-\*\/\.\(\)%]+$/.test(expression)) {
    throw new Error(`Unsafe expression: "${expression}"`);
  }
  return new Function(`"use strict"; return (${expression})`)() as number;
}

/** Simulated weather data (no real API needed). */
const WEATHER_DATA: Record<string, { temp: number; condition: string; humidity: number }> = {
  "new york": { temp: 22, condition: "Partly Cloudy", humidity: 65 },
  "london": { temp: 15, condition: "Overcast", humidity: 80 },
  "tokyo": { temp: 28, condition: "Sunny", humidity: 55 },
  "sydney": { temp: 18, condition: "Clear", humidity: 60 },
  "paris": { temp: 20, condition: "Light Rain", humidity: 75 },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== 03 - Tool Calling ===\n");

  registerProvider(createOpenAIProvider());

  const model = createModel(
    `openai:${MODEL}`,
    {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature: 0,
      maxTokens: 512,
    },
  );

  const agent = createAgent({
    name: "tool-agent",
    model,
    systemPrompt:
      "You are a helpful assistant with access to a calculator and a weather service. " +
      "Use tools when appropriate to answer user questions accurately.",
    tools: [
      {
        name: "calculate",
        description:
          "Evaluate a mathematical expression and return the numeric result. " +
          "Supports +, -, *, /, %, and parentheses.",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The math expression to evaluate, e.g. '(42 * 13) / 7'",
            },
          },
          required: ["expression"],
        },
        execute: async (params: Record<string, unknown>): Promise<unknown> => {
          const expr = params.expression as string;
          const result = evalExpression(expr);
          console.log(`  [calculator] ${expr} = ${result}`);
          return { result, expression: expr };
        },
      },
      {
        name: "get_weather",
        description: "Get the current weather for a given city.",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "The city name, e.g. 'London'",
            },
          },
          required: ["city"],
        },
        execute: async (params: Record<string, unknown>): Promise<unknown> => {
          const city = (params.city as string).toLowerCase();
          const weather = WEATHER_DATA[city] ?? {
            temp: Math.floor(Math.random() * 30) + 5,
            condition: "Unknown",
            humidity: Math.floor(Math.random() * 40) + 40,
          };
          console.log(`  [weather] ${params.city}: ${weather.temp}°C, ${weather.condition}`);
          return {
            city: params.city,
            temperature_celsius: weather.temp,
            condition: weather.condition,
            humidity_percent: weather.humidity,
          };
        },
      },
    ],
    maxIterations: 8,
    hooks: {
      onStart: (input) => console.log(`\n> ${input}`),
      onToolCall: (toolCall) =>
        console.log(`  [calling ${toolCall.name}]`),
      onEnd: (response) =>
        console.log(`\n🤖  ${response.text}\n  [${response.usage.totalTokens} tokens]\n`),
    },
  });

  // Run several queries
  const queries = [
    "What is 1337 * 42?",
    "What's the weather like in Tokyo and London right now?",
    "If it's 28°C in Tokyo and 15°C in London, what's the average temperature? Use the calculator.",
  ];

  for (const query of queries) {
    await agent.run(query);
  }

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
