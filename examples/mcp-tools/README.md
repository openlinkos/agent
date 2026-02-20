# MCP Tools

An agent using tools from an MCP (Model Context Protocol) server via the bridge.

## What it demonstrates

- Running a local MCP server with stdio transport (JSON-RPC 2.0)
- Connecting to the MCP server with `createMCPClient()`
- Discovering tools dynamically via `client.listTools()`
- Bridging MCP tools to agent-compatible tools with `mcpToolsToAgentTools()`
- An agent seamlessly using external MCP tools

## Run

```bash
npx tsx mcp-agent.ts
```

This will automatically spawn the mock MCP server as a child process — no separate setup needed.

## Files

- **mcp-agent.ts**: The main agent that connects to the MCP server and uses its tools.
- **mock-server.ts**: A simple MCP server providing `get_time` and `echo` tools over stdio.

## Key concepts

- **MCP protocol**: JSON-RPC 2.0 over stdio for tool discovery and invocation.
- **Tool bridge**: `mcpToolsToAgentTools()` converts MCP tool definitions into agent `ToolDefinition` objects, so agents use MCP tools without any special handling.
- **Stdio transport**: The server runs as a child process, communicating via stdin/stdout.
