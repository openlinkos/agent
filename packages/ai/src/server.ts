/**
 * OpenAI-compatible HTTP server for @openlinkos/ai.
 *
 * Wraps an agent behind a POST /v1/chat/completions endpoint that speaks
 * the OpenAI Chat Completions API format (both streaming and non-streaming).
 */

import * as http from "node:http";
import type { ToolDefinition as AIToolDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An agent-like object the server can run. */
export interface ServerAgent {
  readonly name: string;
  run(input: string): Promise<ServerAgentResponse>;
}

/** Minimal agent response shape required by the server. */
export interface ServerAgentResponse {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Options for creating the agent server. */
export interface AgentServerOptions {
  /** Port to listen on (only used when calling server.listen() yourself). */
  port?: number;
  /** Tools to advertise in responses (mapped to OpenAI function format). */
  tools?: AIToolDefinition[];
}

// ---------------------------------------------------------------------------
// OpenAI request / response shapes
// ---------------------------------------------------------------------------

interface OpenAIChatRequest {
  model?: string;
  messages: Array<{
    role: string;
    content: string | null;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
}

interface OpenAIFunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIToolCallResponse {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function extractUserMessage(messages: OpenAIChatRequest["messages"]): string {
  // Take the last user message as input
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content) {
      return messages[i].content as string;
    }
  }
  return "";
}

function mapToolsToOpenAI(tools: AIToolDefinition[]): OpenAIFunctionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function mapToolCallsToOpenAI(
  toolCalls: ServerAgentResponse["toolCalls"],
): OpenAIToolCallResponse[] {
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
    },
  }));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJSON(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

function sendSSE(res: http.ServerResponse, data: string): void {
  res.write(`data: ${data}\n\n`);
}

// ---------------------------------------------------------------------------
// Non-streaming response
// ---------------------------------------------------------------------------

function buildChatResponse(
  id: string,
  agentName: string,
  agentResponse: ServerAgentResponse,
  tools?: AIToolDefinition[],
): Record<string, unknown> {
  const hasToolCalls = agentResponse.toolCalls.length > 0;

  const message: Record<string, unknown> = {
    role: "assistant",
    content: agentResponse.text || null,
  };

  if (hasToolCalls) {
    message.tool_calls = mapToolCallsToOpenAI(agentResponse.toolCalls);
  }

  const response: Record<string, unknown> = {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: agentName,
    choices: [
      {
        index: 0,
        message,
        finish_reason: hasToolCalls ? "tool_calls" : "stop",
      },
    ],
    usage: {
      prompt_tokens: agentResponse.usage.promptTokens,
      completion_tokens: agentResponse.usage.completionTokens,
      total_tokens: agentResponse.usage.totalTokens,
    },
  };

  if (tools && tools.length > 0) {
    (response as Record<string, unknown>).tools = mapToolsToOpenAI(tools);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Streaming response
// ---------------------------------------------------------------------------

function sendStreamingResponse(
  res: http.ServerResponse,
  id: string,
  agentName: string,
  agentResponse: ServerAgentResponse,
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const hasToolCalls = agentResponse.toolCalls.length > 0;
  const created = Math.floor(Date.now() / 1000);

  // Role chunk
  sendSSE(res, JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model: agentName,
    choices: [{
      index: 0,
      delta: { role: "assistant", content: "" },
      finish_reason: null,
    }],
  }));

  // Content chunks — split text into small pieces
  if (agentResponse.text) {
    const chunkSize = 20;
    for (let i = 0; i < agentResponse.text.length; i += chunkSize) {
      const textChunk = agentResponse.text.slice(i, i + chunkSize);
      sendSSE(res, JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model: agentName,
        choices: [{
          index: 0,
          delta: { content: textChunk },
          finish_reason: null,
        }],
      }));
    }
  }

  // Tool call chunks
  if (hasToolCalls) {
    for (let i = 0; i < agentResponse.toolCalls.length; i++) {
      const tc = agentResponse.toolCalls[i];
      sendSSE(res, JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model: agentName,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: i,
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            }],
          },
          finish_reason: null,
        }],
      }));
    }
  }

  // Final chunk with finish_reason
  sendSSE(res, JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model: agentName,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: hasToolCalls ? "tool_calls" : "stop",
    }],
    usage: {
      prompt_tokens: agentResponse.usage.promptTokens,
      completion_tokens: agentResponse.usage.completionTokens,
      total_tokens: agentResponse.usage.totalTokens,
    },
  }));

  sendSSE(res, "[DONE]");
  res.end();
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

function sendErrorResponse(
  res: http.ServerResponse,
  status: number,
  message: string,
  type: string = "invalid_request_error",
): void {
  sendJSON(res, status, {
    error: {
      message,
      type,
      code: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create an HTTP server that exposes an agent via the OpenAI Chat Completions API.
 *
 * The server handles `POST /v1/chat/completions` requests, parses OpenAI-format
 * request bodies, runs the agent, and returns responses in OpenAI format.
 *
 * Supports both streaming (`stream: true`) and non-streaming responses.
 *
 * @param agent - The agent to serve.
 * @param options - Optional server configuration.
 * @returns A Node.js http.Server (not yet listening).
 *
 * @example
 * ```typescript
 * import { createAgentServer } from "@openlinkos/ai";
 *
 * const server = createAgentServer(myAgent, { port: 3000 });
 * server.listen(3000, () => console.log("Listening on :3000"));
 * ```
 */
export function createAgentServer(
  agent: ServerAgent,
  options?: AgentServerOptions,
): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    // Only handle POST /v1/chat/completions
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      sendErrorResponse(res, 404, `Not found: ${req.method} ${req.url}`);
      return;
    }

    let body: OpenAIChatRequest;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw) as OpenAIChatRequest;
    } catch {
      sendErrorResponse(res, 400, "Invalid JSON in request body.");
      return;
    }

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      sendErrorResponse(res, 400, "messages is required and must be a non-empty array.");
      return;
    }

    const userInput = extractUserMessage(body.messages);
    const id = generateId();

    try {
      const agentResponse = await agent.run(userInput);

      if (body.stream) {
        sendStreamingResponse(res, id, agent.name, agentResponse);
      } else {
        const chatResponse = buildChatResponse(id, agent.name, agentResponse, options?.tools);
        sendJSON(res, 200, chatResponse);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendErrorResponse(res, 500, message, "server_error");
    }
  });

  return server;
}
