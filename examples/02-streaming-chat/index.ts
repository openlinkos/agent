/**
 * 02 - Streaming Chat
 *
 * An interactive CLI chatbot that streams responses token-by-token.
 * Demonstrates: model.stream(), StreamEvent handling, multi-turn conversation.
 *
 * Run: npx tsx examples/02-streaming-chat/index.ts
 * Type your message and press Enter. Type "exit" or press Ctrl+C to quit.
 */

import "dotenv/config";
import * as readline from "node:readline";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
  type Message,
} from "@openlinkos/ai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  Set up your API key in .env or pass it inline:");
  console.log("    OPENAI_API_KEY=sk-... npx tsx examples/02-streaming-chat/index.ts\n");
  process.exit(1);
}

const SYSTEM_PROMPT = "You are a helpful, concise assistant. Keep responses brief and conversational.";

async function main(): Promise<void> {
  console.log("=== 02 - Streaming Chat ===");
  console.log(`Model: ${MODEL}`);
  console.log('Type your message and press Enter. Type "exit" to quit.\n');

  registerProvider(createOpenAIProvider());
  const model = createModel(
    `openai:${MODEL}`,
    {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature: 0.8,
      maxTokens: 512,
    },
  );

  const history: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      process.stdout.write("You: ");
      rl.once("line", resolve);
    });

  console.log("Chat started! ✨\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let userInput: string;
    try {
      userInput = await prompt();
    } catch {
      // stdin closed
      break;
    }

    userInput = userInput.trim();
    if (!userInput) continue;
    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("\nGoodbye! 👋");
      break;
    }

    history.push({ role: "user", content: userInput });

    process.stdout.write("\nAssistant: ");

    const streamResult = await model.stream([...history]);
    let fullText = "";
    let totalTokens: number | undefined;

    for await (const event of streamResult) {
      if (event.type === "text_delta") {
        process.stdout.write(event.text);
        fullText += event.text;
      } else if (event.type === "usage") {
        totalTokens = event.usage.totalTokens;
      } else if (event.type === "done") {
        process.stdout.write("\n\n");
        if (totalTokens !== undefined) {
          process.stdout.write(`[Tokens: ${totalTokens} total]\n\n`);
        }
      }
    }

    if (fullText) {
      history.push({ role: "assistant", content: fullText });
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
