# @openlinkos/mcp

Model Context Protocol (MCP) client for tool connectivity.

## Overview

`@openlinkos/mcp` provides first-class support for the Model Context Protocol. Connect your agents to any MCP-compatible tool server and use discovered tools seamlessly within the agent framework.

## Installation

```bash
pnpm add @openlinkos/mcp
```

## Usage

### As a Client

Connect to an existing MCP tool server:

```typescript
import { createMCPClient } from "@openlinkos/mcp";

const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

await client.connect();
const tools = await client.listTools();
console.log("Available tools:", tools.map(t => t.name));

const result = await client.callTool("read_file", { path: "/tmp/data.txt" });
await client.disconnect();
```

### Bridge to Agent Tools

Convert MCP tools to agent-compatible `ToolDefinition` objects:

```typescript
import { createMCPClient, mcpToolsToAgentTools } from "@openlinkos/mcp";

const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

await client.connect();
const mcpTools = await client.listTools();
const tools = mcpToolsToAgentTools(mcpTools, client);
```

## Features

- **MCP Client** — Connect to any MCP-compatible tool server
- **Multiple transports** — stdio, SSE, and streamable-http
- **Tool bridge** — Convert MCP tools to agent ToolDefinitions
- **Tool discovery** — Dynamic tool listing and schema introspection
- **Session management** — Connection lifecycle and authentication
