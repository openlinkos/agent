/**
 * 06 - MCP Tools
 *
 * Connects to a local MCP server (stdio transport) and exposes its tools
 * to a real LLM agent. The agent can then use the tools via the ReAct loop.
 * Demonstrates: MCPClient, StdioTransport, createMCPTools, createAgent with MCP tools.
 *
 * Run: npx tsx examples/06-mcp-tools/index.ts
 * The MCP server (server.ts) is automatically spawned as a child process.
 */

import "dotenv/config";
import * as path from "node:path";
import * as url from "node:url";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createMCPClient, mcpToolsToAgentTools } from "@openlinkos/mcp";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/06-mcp-tools/index.ts\n");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("=== 06 - MCP Tools ===\n");

  // Locate the server script relative to this file
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const serverPath = path.join(__dirname, "server.ts");

  console.log("🔌  Starting MCP server (stdio)...");

  // Create MCP client with stdio transport (spawns server.ts as child process)
  const mcpClient = createMCPClient({
    server: "npx",
    args: ["tsx", serverPath],
    transport: "stdio",
    requestTimeout: 15_000,
  });

  await mcpClient.connect();
  console.log("✅  MCP server connected\n");

  // Discover and convert MCP tools to agent-compatible tools
  const mcpTools = await mcpClient.listTools();
  console.log(`🛠️  Discovered ${mcpTools.length} MCP tools:`);
  mcpTools.forEach((t) => console.log(`   • ${t.name}: ${t.description}`));
  console.log();

  const agentTools = mcpToolsToAgentTools(mcpTools, mcpClient);

  registerProvider(createOpenAIProvider());
  const model = createModel(`openai:${MODEL}`, {
    apiKey: OPENAI_API_KEY,
    ...(BASE_URL ? { baseURL: BASE_URL } : {}),
    temperature: 0,
    maxTokens: 512,
  });

  const agent = createAgent({
    name: "mcp-agent",
    model,
    systemPrompt:
      "You are a helpful assistant with access to utility tools via MCP. " +
      "Use the tools to answer questions accurately.",
    tools: agentTools,
    maxIterations: 6,
    hooks: {
      onStart: (input) => console.log(`\n> ${input}`),
      onToolCall: (call) => console.log(`  [→ ${call.name}]`),
      onToolResult: (_call, result) => console.log(`  [← ${result.slice(0, 80)}${result.length > 80 ? "..." : ""}]`),
      onEnd: (response) => console.log(`\n🤖  ${response.text}\n`),
    },
  });

  const queries = [
    "What time is it right now in Tokyo and New York?",
    "Calculate: what is 2^10 + 3^5?",
    "Generate 3 UUIDs for me.",
    "How many words are in the phrase: 'The quick brown fox jumps over the lazy dog'?",
  ];

  for (const query of queries) {
    await agent.run(query);
  }

  console.log("🔌  Disconnecting MCP server...");
  await mcpClient.disconnect();
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
