/**
 * MCP Tool Server (stdio, JSON-RPC 2.0)
 *
 * A realistic MCP-compatible server providing:
 *   - get_datetime: Returns current date/time in a given timezone
 *   - calculate: Evaluates a math expression
 *   - word_count: Counts words, characters, and lines in text
 *   - generate_uuid: Generates a random UUID v4
 *
 * This server is spawned as a child process by index.ts.
 * Communicates via stdin/stdout using newline-delimited JSON-RPC 2.0.
 *
 * Run standalone: npx tsx examples/06-mcp-tools/server.ts
 */

import * as readline from "node:readline";
import * as crypto from "node:crypto";

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

const tools = [
  {
    name: "get_datetime",
    description: "Get the current date and time, optionally in a specific timezone.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone name, e.g. 'America/New_York', 'Asia/Tokyo'. Defaults to 'UTC'.",
        },
        format: {
          type: "string",
          description: "Output format: 'iso' (ISO 8601) or 'human' (human-readable). Defaults to 'human'.",
        },
      },
      required: [],
    },
  },
  {
    name: "calculate",
    description: "Evaluate a safe mathematical expression. Supports +, -, *, /, %, and parentheses.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The math expression to evaluate, e.g. '(3.14 * 10^2)'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "word_count",
    description: "Count words, characters, and lines in a text.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to analyze",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "generate_uuid",
    description: "Generate one or more random UUID v4 strings.",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of UUIDs to generate (1-10). Defaults to 1.",
        },
      },
      required: [],
    },
  },
];

function handleToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "get_datetime": {
      const tz = (args.timezone as string) || "UTC";
      const fmt = (args.format as string) || "human";
      const now = new Date();
      if (fmt === "iso") {
        return new Date(now.toLocaleString("en-US", { timeZone: tz })).toISOString();
      }
      return now.toLocaleString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      });
    }

    case "calculate": {
      const expr = args.expression as string;
      if (!/^[\d\s\+\-\*\/\.\(\)\%\^e]+$/i.test(expr)) {
        throw new Error(`Unsafe expression: "${expr}"`);
      }
      // Replace ^ with ** for exponentiation
      const safeExpr = expr.replace(/\^/g, "**");
      const result = new Function(`"use strict"; return (${safeExpr})`)() as number;
      return `${expr} = ${result}`;
    }

    case "word_count": {
      const text = args.text as string;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      const charsNoSpaces = text.replace(/\s/g, "").length;
      const lines = text.split("\n").length;
      return JSON.stringify({ words, characters: chars, charactersNoSpaces: charsNoSpaces, lines });
    }

    case "generate_uuid": {
      const count = Math.min(Math.max(1, (args.count as number) || 1), 10);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      return uuids.join("\n");
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

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
          serverInfo: { name: "utility-mcp-server", version: "0.1.0" },
        },
      };

    case "notifications/initialized":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } };

    case "tools/call": {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const content = handleToolCall(toolName, toolArgs);
        return { jsonrpc: "2.0", id, result: { content, isError: false } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { jsonrpc: "2.0", id, result: { content: message, isError: true } };
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const request = JSON.parse(trimmed) as JsonRpcRequest;
    const response = handleRequest(request);
    process.stdout.write(JSON.stringify(response) + "\n");
  } catch {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: 0, error: { code: -32700, message: "Parse error" } }) + "\n",
    );
  }
});

process.stderr.write("Utility MCP server started (stdio)\n");
