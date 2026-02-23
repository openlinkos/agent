# 06 - MCP Tools

Connect a real LLM agent to an **MCP (Model Context Protocol)** server. Tools are discovered automatically from the server and made available to the agent.

## What it demonstrates

- `StdioTransport` — spawning an MCP server as a child process
- `createMCPClient` — connecting to the server and discovering tools
- `mcpToolsToAgentTools` — converting MCP tools to agent-compatible `ToolDefinition` objects
- Using MCP-sourced tools in a `createAgent` ReAct loop
- `mcpClient.disconnect()` for clean shutdown

## Architecture

```
index.ts (agent)  ──stdio──►  server.ts (MCP server)
                  ◄──stdio──
```

The MCP server provides:
- `get_datetime` — Current date/time in any timezone
- `calculate` — Safe math expression evaluator
- `word_count` — Text analysis (words, chars, lines)
- `generate_uuid` — Random UUID v4 generation

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/06-mcp-tools/index.ts
```

The MCP server is started automatically. You can also run it standalone:

```bash
npx tsx examples/06-mcp-tools/server.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model (must support tool calling) |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |

## Expected Output

```
=== 06 - MCP Tools ===

🔌  Starting MCP server (stdio)...
✅  MCP server connected

🛠️  Discovered 4 MCP tools:
   • get_datetime: Get the current date and time...
   • calculate: Evaluate a safe mathematical expression...
   • word_count: Count words, characters, and lines...
   • generate_uuid: Generate one or more random UUID v4 strings...

> What time is it right now in Tokyo and New York?
  [→ get_datetime]
  [← Monday, February 24, 2026 at 08:15:22 AM JST]
  [→ get_datetime]
  [← Sunday, February 23, 2026 at 06:15:22 PM EST]

🤖  It's currently Monday, Feb 24 at 8:15 AM in Tokyo (JST), and Sunday, Feb 23 at 6:15 PM in New York (EST).
```
