# @openlinkos/mcp

Model Context Protocol client for connecting agents to external tool servers.

## Installation

```bash
pnpm add @openlinkos/mcp
```

## Overview

`@openlinkos/mcp` provides first-class support for the [Model Context Protocol](https://modelcontextprotocol.io). Connect your agents to any MCP-compatible tool server, or expose your own tools as MCP endpoints.

## `createMCPClient()`

Create a client that connects to an MCP tool server:

```typescript
import { createMCPClient } from "@openlinkos/mcp";

const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

await client.connect();
```

**Signature:**

```typescript
function createMCPClient(config: MCPServerConfig): MCPClient
```

## `MCPServerConfig`

```typescript
interface MCPServerConfig {
  /** Command to spawn the MCP server process. */
  server: string;
  /** Transport protocol. */
  transport: "stdio" | "sse" | "websocket";
  /** Connection timeout in milliseconds. */
  timeout?: number;
}
```

## `MCPClient`

```typescript
interface MCPClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
}
```

### List Available Tools

```typescript
const tools = await client.listTools();
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`);
}
```

### Call a Tool

```typescript
const result = await client.callTool("read_file", { path: "/tmp/data.txt" });
console.log(result);
```

## Bridge to Agent Tools

Convert MCP tools to agent-compatible `ToolDefinition` objects:

### `createMCPTools()`

The simplest way to use MCP tools with an agent:

```typescript
import { createMCPClient, createMCPTools } from "@openlinkos/mcp";
import { createAgent } from "@openlinkos/agent";
import { createModel } from "@openlinkos/ai";

const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

await client.connect();
const tools = createMCPTools(client);

const agent = createAgent({
  name: "file-agent",
  model: createModel("openai:gpt-4o"),
  systemPrompt: "You help with file operations.",
  tools,
});

const response = await agent.run("List files in /tmp");
await client.disconnect();
```

**Signature:**

```typescript
function createMCPTools(client: MCPClient): ToolDefinition[]
```

### `mcpToolToAgentTool()`

Convert a single MCP tool:

```typescript
import { mcpToolToAgentTool } from "@openlinkos/mcp";

const agentTool = mcpToolToAgentTool(mcpTool);
```

### `mcpToolsToAgentTools()`

Convert an array of MCP tools:

```typescript
import { mcpToolsToAgentTools } from "@openlinkos/mcp";

const agentTools = mcpToolsToAgentTools(mcpTools);
```

## Transports

### stdio

Communicates with the MCP server over standard input/output. The server is spawned as a child process:

```typescript
const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});
```

### SSE (Server-Sent Events)

Connect to an HTTP-based MCP server:

```typescript
const client = createMCPClient({
  server: "http://localhost:3000/mcp",
  transport: "sse",
});
```

### WebSocket

Full-duplex communication:

```typescript
const client = createMCPClient({
  server: "ws://localhost:3000/mcp",
  transport: "websocket",
});
```

## Types

### `MCPTool`

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

### `MCPToolResult`

```typescript
interface MCPToolResult {
  content: unknown;
  isError?: boolean;
}
```

### `MCPTransport`

```typescript
interface MCPTransport {
  send(request: MCPRequest): Promise<MCPResponse>;
  close(): Promise<void>;
}
```
