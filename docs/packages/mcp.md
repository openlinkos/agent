# @openlinkos/mcp

Model Context Protocol (MCP) client and server for tool connectivity.

## Overview

`@openlinkos/mcp` provides first-class support for the Model Context Protocol. Connect your agents to any MCP-compatible tool server, or expose your own tools as MCP endpoints that other applications can consume.

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

### As a Server

Expose your tools as an MCP endpoint:

```typescript
import { createMCPServer } from "@openlinkos/mcp";

const server = createMCPServer({ transport: "stdio" });

server.registerTool({
  name: "search_docs",
  description: "Search the documentation",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  handler: async ({ query }) => {
    return { results: [`Result for: ${query}`] };
  },
});

await server.start();
```

## Features

- **MCP Client** — Connect to any MCP-compatible tool server
- **MCP Server** — Expose agents and tools as MCP endpoints
- **Multiple transports** — stdio, HTTP/SSE, and WebSocket
- **Tool discovery** — Dynamic tool listing and schema introspection
- **Session management** — Connection lifecycle and authentication
- **Caching** — Optional tool result caching and rate limiting
