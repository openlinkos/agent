/**
 * Mock MCP Server (stdio, JSON-RPC)
 *
 * A simple MCP-compatible server that provides two tools:
 * - get_time: Returns the current time
 * - echo: Echoes back the input
 *
 * Communicates via stdin/stdout using newline-delimited JSON-RPC 2.0.
 *
 * Usage: npx tsx mock-server.ts
 */

import * as readline from "readline";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Tool definitions this server provides
const tools = [
  {
    name: "get_time",
    description: "Get the current date and time",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "Timezone (e.g. 'UTC', 'America/New_York'). Defaults to UTC.",
        },
      },
      required: [],
    },
  },
  {
    name: "echo",
    description: "Echo back the provided message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
      },
      required: ["message"],
    },
  },
];

function handleRequest(request: JsonRpcRequest): JsonRpcResponse {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "mock-mcp-server",
            version: "0.1.0",
          },
        },
      };

    case "notifications/initialized":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools },
      };

    case "tools/call": {
      const toolName = params?.name as string;
      const args = (params?.arguments ?? {}) as Record<string, unknown>;

      if (toolName === "get_time") {
        const tz = (args.timezone as string) || "UTC";
        const now = new Date().toLocaleString("en-US", { timeZone: tz });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: `Current time (${tz}): ${now}`,
            isError: false,
          },
        };
      }

      if (toolName === "echo") {
        const message = args.message as string;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: `Echo: ${message}`,
            isError: false,
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: `Unknown tool: ${toolName}`,
          isError: true,
        },
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// Read from stdin, write to stdout — newline-delimited JSON-RPC
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed) as JsonRpcRequest;
    const response = handleRequest(request);
    process.stdout.write(JSON.stringify(response) + "\n");
  } catch {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: 0,
      error: { code: -32700, message: "Parse error" },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});

// Log to stderr so it doesn't interfere with JSON-RPC on stdout
process.stderr.write("Mock MCP server started (stdio transport)\n");
