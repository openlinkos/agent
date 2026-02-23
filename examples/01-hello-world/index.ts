/**
 * 01 - Hello World
 *
 * The simplest possible example: send a message to an LLM and print the response.
 * Demonstrates: registerProvider, createModel, model.generate().
 *
 * Prerequisites:
 *   - Copy .env.example to .env and set OPENAI_API_KEY
 *   - Or set the environment variable directly: OPENAI_API_KEY=sk-... npx tsx index.ts
 *
 * Run: npx tsx examples/01-hello-world/index.ts
 */

import "dotenv/config";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("");
  console.log("💡  Set up your API key:");
  console.log("    1. Copy .env.example to .env");
  console.log("    2. Add your key: OPENAI_API_KEY=sk-...");
  console.log("");
  console.log("    Or pass it inline:");
  console.log("    OPENAI_API_KEY=sk-... npx tsx examples/01-hello-world/index.ts");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("=== 01 - Hello World ===\n");

  // Register the OpenAI provider
  registerProvider(createOpenAIProvider());

  // Create a model instance
  const model = createModel(
    `openai:${MODEL}`,
    {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature: 0.7,
      maxTokens: 256,
    },
  );

  console.log(`📡  Using model: ${model.modelId}`);
  console.log("📨  Sending: \"Hello! Who are you and what can you do?\"\n");

  const response = await model.generate([
    {
      role: "system",
      content: "You are a helpful assistant built with the OpenLinkOS Agent Framework.",
    },
    {
      role: "user",
      content: "Hello! Who are you and what can you do? Keep it brief (2-3 sentences).",
    },
  ]);

  console.log("🤖  Response:");
  console.log(response.text);
  console.log("");
  console.log(`📊  Tokens used: ${response.usage.totalTokens} (prompt: ${response.usage.promptTokens}, completion: ${response.usage.completionTokens})`);
  console.log(`✅  Finish reason: ${response.finishReason}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
