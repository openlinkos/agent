/**
 * MCP Tools Example
 *
 * Demonstrates: Agent using MCP tools via the bridge. Connects to a
 * local mock MCP server (stdio) and uses its tools within an agent.
 *
 * Run: npx tsx mcp-agent.ts
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  registerProvider,
  createModel,
  clearProviders,
  type ModelProvider,
  type ModelCapabilities,
  type Message,
  type ModelResponse,
  type ToolDefinition,
  type ProviderRequestOptions,
  type StreamResult,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createMCPClient, mcpToolsToAgentTools } from "@openlinkos/mcp";

// ---------------------------------------------------------------------------
// Mock provider — MCP-tool-aware responses
// ---------------------------------------------------------------------------

function createMCPMockProvider(): ModelProvider {
  let callCount = 0;

  return {
    name: "mock",
    capabilities: {
      streaming: false,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    } satisfies ModelCapabilities,

    async generate(
      messages: Message[],
      _options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      const last = messages[messages.length - 1];
      return {
        text: `Received: ${last.role === "user" ? last.content : "response"}`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        finishReason: "stop",
      };
    },

    async stream(): Promise<StreamResult> {
      throw new Error("Streaming not implemented in mock provider");
    },

    async generateWithTools(
      messages: Message[],
      tools: ToolDefinition[],
      _options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      callCount++;
      const last = messages[messages.length - 1];

      // After tool results come back, produce a final text answer
      if (last.role === "tool") {
        return {
          text: `Based on the tool results: ${last.content}`,
          toolCalls: [],
          usage: { promptTokens: 15, completionTokens: 20, totalTokens: 35 },
          finishReason: "stop",
        };
      }

      const userMsg = last.role === "user" ? last.content : "";

      // Detect time-related questions
      if (/time|clock|date|now/i.test(userMsg)) {
        const timeTool = tools.find((t) => t.name === "get_time");
        if (timeTool) {
          return {
            text: null,
            toolCalls: [
              {
                id: `call_${callCount}`,
                name: "get_time",
                arguments: { timezone: "UTC" },
              },
            ],
            usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
            finishReason: "tool_calls",
          };
        }
      }

      // Detect echo-related requests
      if (/echo|repeat|say/i.test(userMsg)) {
        const echoTool = tools.find((t) => t.name === "echo");
        if (echoTool) {
          return {
            text: null,
            toolCalls: [
              {
                id: `call_${callCount}`,
                name: "echo",
                arguments: { message: userMsg },
              },
            ],
            usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
            finishReason: "tool_calls",
          };
        }
      }

      return {
        text: `I have access to these MCP tools: ${tools.map((t) => t.name).join(", ")}. Try asking about the time or asking me to echo something!`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 },
        finishReason: "stop",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== MCP Tools Example ===\n");

  // 1. Set up mock LLM provider
  clearProviders();
  registerProvider(createMCPMockProvider());
  const model = createModel("mock:mcp-v1");

  // 2. Connect to the mock MCP server via stdio
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const serverPath = resolve(__dirname, "mock-server.ts");

  console.log("Connecting to mock MCP server...");
  const client = createMCPClient({
    server: "npx",
    args: ["tsx", serverPath],
    transport: "stdio",
    requestTimeout: 10_000,
  });

  await client.connect();
  console.log("Connected!\n");

  // 3. Discover and bridge MCP tools
  const mcpTools = await client.listTools();
  console.log("Available MCP tools:");
  for (const tool of mcpTools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }
  console.log();

  const tools = mcpToolsToAgentTools(mcpTools, client);

  // 4. Create an agent with the MCP tools
  const agent = createAgent({
    name: "mcp-agent",
    model,
    systemPrompt:
      "You are a helpful assistant with access to MCP tools. Use them to answer questions about the current time or to echo messages.",
    tools,
    maxIterations: 5,
    hooks: {
      onToolCall: (toolCall) =>
        console.log(`  [MCP Tool Call] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`),
      onToolResult: (_toolCall, result) =>
        console.log(`  [MCP Tool Result] ${result}`),
    },
  });

  // 5. Run conversations that exercise the MCP tools
  const queries = [
    "What tools do you have?",
    "What time is it now?",
    "Echo this message: Hello from MCP!",
  ];

  for (const query of queries) {
    console.log(`\n> User: ${query}`);
    const response = await agent.run(query);
    console.log(`  Bot: ${response.text}`);
    console.log(`  [Tokens: ${response.usage.totalTokens}]`);
  }

  // 6. Clean up
  await client.disconnect();
  console.log("\nDisconnected from MCP server.");
  console.log("\n=== MCP example complete ===");
}

main().catch(console.error);
