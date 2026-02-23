/**
 * 07 - Memory Conversation
 *
 * A multi-turn conversation that remembers context across turns.
 * Also demonstrates SessionManager for managing multiple user sessions
 * with optional FileStore persistence (resumes across restarts).
 * Demonstrates: Conversation, createConversation, SessionManager, FileStore.
 *
 * Run: npx tsx examples/07-memory-conversation/index.ts
 */

import "dotenv/config";
import * as path from "node:path";
import * as url from "node:url";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import {
  createConversation,
  SessionManager,
  FileStore,
  type AgentConfig,
} from "@openlinkos/agent";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/07-memory-conversation/index.ts\n");
  process.exit(1);
}

const SYSTEM_PROMPT =
  "You are a knowledgeable personal tutor. Remember everything the student tells you " +
  "about themselves and their learning goals. Reference earlier parts of the conversation " +
  "when relevant. Be encouraging and adapt your teaching style to the student.";

async function demonstrateConversation(
  apiKey: string,
  model: string,
  baseURL?: string,
): Promise<void> {
  console.log("─".repeat(50));
  console.log("📖  Part 1: Single-session Conversation with memory");
  console.log("─".repeat(50) + "\n");

  registerProvider(createOpenAIProvider());

  const agentConfig: AgentConfig = {
    name: "tutor",
    model: createModel(`openai:${model}`, {
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      temperature: 0.7,
      maxTokens: 256,
    }),
    systemPrompt: SYSTEM_PROMPT,
  };

  // createConversation wraps the agent config with persistent message history
  const conversation = createConversation(agentConfig);

  const turns = [
    "Hi! I'm learning TypeScript and I'm particularly struggling with generics.",
    "Can you give me a simple example of a generic function?",
    "Great! Now can you show me a generic interface too?",
    "Going back to what I said earlier about struggling with generics — do you have any tips for really internalizing the concept?",
  ];

  for (const message of turns) {
    console.log(`👤  Student: ${message}`);
    const response = await conversation.send(message);
    console.log(`🤖  Tutor: ${response.text}`);
    console.log(`   [${response.usage.totalTokens} tokens | history: ${conversation.getHistory().length} messages]\n`);
  }

  console.log(`📊  Conversation history: ${conversation.getHistory().length} messages total`);
  console.log(`   Messages: ${conversation.getHistory().map((m) => m.role).join(" → ")}\n`);
}

async function demonstrateSessionManager(
  apiKey: string,
  model: string,
  baseURL?: string,
): Promise<void> {
  console.log("─".repeat(50));
  console.log("🗄️  Part 2: SessionManager with FileStore persistence");
  console.log("─".repeat(50) + "\n");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const storePath = path.join(__dirname, ".sessions");

  const store = new FileStore(storePath);

  const agentConfig = {
    name: "tutor-v2",
    model: createModel(`openai:${model}`, {
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      temperature: 0.7,
      maxTokens: 256,
    }),
    systemPrompt: SYSTEM_PROMPT,
  };

  const sessionManager = new SessionManager({ agentConfig, store });

  // Simulate two different users in separate sessions
  const users = [
    { id: "alice", messages: ["I'm Alice. I'm learning Python.", "What's a list comprehension?"] },
    { id: "bob", messages: ["I'm Bob. I'm learning Rust.", "Can you explain ownership?"] },
  ];

  for (const user of users) {
    console.log(`\n👤  Session: ${user.id}`);
    const session = await sessionManager.getSession(user.id);

    for (const msg of user.messages) {
      console.log(`   > ${msg}`);
      const response = await session.send(msg);
      const preview = response.text.slice(0, 100) + (response.text.length > 100 ? "..." : "");
      console.log(`   🤖  ${preview}`);
    }

    // Save to FileStore
    await sessionManager.saveSession(user.id);
    console.log(`   💾  Session "${user.id}" saved to disk`);
  }

  // Demonstrate resumption
  console.log("\n🔄  Resuming Alice's session (loaded from disk)...");
  const aliceSession = await sessionManager.getSession("alice");
  const resumeResponse = await aliceSession.send("Going back to what I told you about myself — can you remind me what you know about me?");
  console.log(`   🤖  ${resumeResponse.text.slice(0, 150)}...`);
  console.log(`   📊  History length: ${aliceSession.getHistory().length} messages`);

  // Clean up saved sessions
  await store.delete("alice");
  await store.delete("bob");
  console.log("\n🗑️  Cleaned up saved sessions");
}

async function main(): Promise<void> {
  console.log("=== 07 - Memory Conversation ===\n");

  await demonstrateConversation(OPENAI_API_KEY!, MODEL, BASE_URL);
  await demonstrateSessionManager(OPENAI_API_KEY!, MODEL, BASE_URL);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
