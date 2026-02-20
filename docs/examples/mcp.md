# MCP Integration

Connect agents to external tool servers using the Model Context Protocol (MCP).

## Code

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createMCPClient, createMCPTools } from "@openlinkos/mcp";

const model = createModel("openai:gpt-4o");

// 1. Connect to an MCP tool server
const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem /tmp",
  transport: "stdio",
});

await client.connect();

// 2. List available tools
const mcpTools = await client.listTools();
console.log("Available MCP tools:");
for (const tool of mcpTools) {
  console.log(`  - ${tool.name}: ${tool.description}`);
}

// 3. Convert MCP tools to agent tools
const tools = createMCPTools(client);

// 4. Create an agent with MCP tools
const agent = createAgent({
  name: "file-agent",
  model,
  systemPrompt: `You are a file management assistant.
You can read, write, and list files using your available tools.
Always confirm actions before modifying files.`,
  tools,
  hooks: {
    onToolCall: (toolCall) => {
      console.log(`[MCP Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
    },
  },
});

// 5. Use the agent
const response = await agent.run("List all files in /tmp and show me the contents of any .txt files");
console.log(response.text);

// 6. Clean up
await client.disconnect();
```

## What This Demonstrates

- Connecting to an MCP-compatible tool server (filesystem server)
- Discovering tools dynamically via `listTools()`
- Bridging MCP tools to agent-compatible `ToolDefinition` objects
- An agent using external tools seamlessly through MCP

## Run It

```bash
export OPENAI_API_KEY=sk-...

npx tsx mcp-example.ts
```

## Connecting to Multiple Servers

You can connect to multiple MCP servers and combine their tools:

```typescript
import { createMCPClient, createMCPTools } from "@openlinkos/mcp";

const fileClient = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem /tmp",
  transport: "stdio",
});

const gitClient = createMCPClient({
  server: "npx @modelcontextprotocol/server-github",
  transport: "stdio",
});

await Promise.all([fileClient.connect(), gitClient.connect()]);

const fileTools = createMCPTools(fileClient);
const gitTools = createMCPTools(gitClient);

const agent = createAgent({
  name: "dev-assistant",
  model,
  systemPrompt: "You help with file operations and GitHub tasks.",
  tools: [...fileTools, ...gitTools],
});

const response = await agent.run("List files in /tmp and check my GitHub notifications");
console.log(response.text);

await Promise.all([fileClient.disconnect(), gitClient.disconnect()]);
```

## Using SSE Transport

Connect to HTTP-based MCP servers:

```typescript
const client = createMCPClient({
  server: "http://localhost:3001/mcp",
  transport: "sse",
  timeout: 10000,
});

await client.connect();
```

## Using WebSocket Transport

For full-duplex communication:

```typescript
const client = createMCPClient({
  server: "ws://localhost:3001/mcp",
  transport: "websocket",
});

await client.connect();
```

## Calling Tools Directly

You can also call MCP tools without going through an agent:

```typescript
const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem /tmp",
  transport: "stdio",
});

await client.connect();

// Call a tool directly
const result = await client.callTool("read_file", { path: "/tmp/data.txt" });
console.log(result.content);

await client.disconnect();
```
