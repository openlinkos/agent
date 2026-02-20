# @openlinkos/mcp

Model Context Protocol client for connecting agents to external tool servers.

## Installation

```bash
pnpm add @openlinkos/mcp
```

## Overview

`@openlinkos/mcp` provides first-class support for the [Model Context Protocol](https://modelcontextprotocol.io). Connect your agents to any MCP-compatible tool server.

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
  /** Command to spawn the MCP server process (stdio) or URL (SSE/HTTP). */
  server: string;
  /** Arguments for the server command (stdio transport). */
  args?: string[];
  /** Transport protocol. */
  transport: "stdio" | "sse" | "streamable-http";
  /** Optional authentication token. */
  authToken?: string;
  /** Connection timeout in milliseconds. Default: 10000. */
  connectTimeout?: number;
  /** Request timeout in milliseconds. Default: 30000. */
  requestTimeout?: number;
  /** Environment variables to pass to stdio child process. */
  env?: Record<string, string>;
}
```

## `MCPClient`

```typescript
interface MCPClientInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult>;
  readonly connected: boolean;
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

Connect to an MCP server and return Agent-compatible ToolDefinitions for all available tools:

```typescript
import { createMCPTools } from "@openlinkos/mcp";
import { createAgent } from "@openlinkos/agent";
import { createModel } from "@openlinkos/ai";

const { client, tools } = await createMCPTools({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

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
function createMCPTools(
  serverConfig: MCPServerConfig,
): Promise<{ client: MCPClientInterface; tools: ToolDefinition[] }>
```

### `mcpToolToAgentTool()`

Convert a single MCP tool:

```typescript
import { mcpToolToAgentTool } from "@openlinkos/mcp";

const agentTool = mcpToolToAgentTool(mcpTool, client);
```

### `mcpToolsToAgentTools()`

Convert an array of MCP tools:

```typescript
import { mcpToolsToAgentTools } from "@openlinkos/mcp";

const agentTools = mcpToolsToAgentTools(mcpTools, client);
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

### Streamable HTTP

HTTP-based bidirectional communication:

```typescript
const client = createMCPClient({
  server: "http://localhost:3000/mcp",
  transport: "streamable-http",
});
```

## Types

### `MCPTool`

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
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
type MCPTransport = "stdio" | "sse" | "streamable-http";
```
