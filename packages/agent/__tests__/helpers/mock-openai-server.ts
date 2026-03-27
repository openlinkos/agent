/**
 * Mock OpenAI-compatible server for E2E tests (agent package copy).
 *
 * Duplicated from packages/ai/__tests__/helpers/mock-openai-server.ts
 * because vitest cannot resolve test helpers across package boundaries.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";

export interface MockOpenAI {
  url: string;
  close: () => void;
}

export function createMockOpenAI(): Promise<MockOpenAI> {
  const server = createServer(handler);

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/v1`,
        close: () => server.close(),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

interface MockTool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface MockMessage {
  role: string;
  content?: string | null;
  tool_call_id?: string;
}

interface MockAssistantMessage extends MockMessage {
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
}

function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf-8");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const path = req.url ?? "";
    if (path.endsWith("/chat/completions")) {
      handleChatCompletions(body, res);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

function handleChatCompletions(body: Record<string, unknown>, res: ServerResponse) {
  const isStream = body.stream === true;
  const tools = (body.tools as MockTool[] | undefined) ?? [];
  const messages = (body.messages as (MockMessage | MockAssistantMessage)[] | undefined) ?? [];

  res.writeHead(200, { "Content-Type": "application/json" });

  const hasTools = Array.isArray(tools) && tools.length > 0;
  const lastUserMsg = findLastUserMessage(messages);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isToolResult = lastMessage?.role === "tool";

  if (isToolResult) {
    const text = generateToolResultSummary(messages);
    if (isStream) {
      writeStreamedText(res, text);
    } else {
      const response = buildChatResponse({
        content: text,
        toolCalls: undefined,
        finishReason: "stop",
      });
      res.end(JSON.stringify(response));
    }
    return;
  }

  const isJsonRequest = !!lastUserMsg && /JSON|json object|respond with/i.test(lastUserMsg);
  const isToolRequest = hasTools && lastUserMsg && !isToolResult &&
    (/tool|use|调用|weather|calculate|population|what is|how many/i.test(lastUserMsg) ||
     /multiply|add|subtract|divide/i.test(lastUserMsg));

  if (isToolRequest && hasTools) {
    const toolName = tools[0].function.name;
    const multiArgs = generateMultiToolArgs(toolName, lastUserMsg);

    if (multiArgs && multiArgs.length > 1) {
      const toolCalls = multiArgs.map((args, i) => ({
        id: `call_mock_00${i + 1}`,
        name: toolName,
        arguments: JSON.stringify(args),
      }));

      if (isStream) {
        writeStreamedMultiToolCall(res, toolName, multiArgs);
      } else {
        const response = buildChatResponse({
          content: null,
          toolCalls,
          finishReason: "tool_calls",
        });
        res.end(JSON.stringify(response));
      }
    } else {
      const toolArgs = generateMockToolArgs(toolName, lastUserMsg);
      if (isStream) {
        writeStreamedToolCall(res, toolName, toolArgs);
      } else {
        const response = buildChatResponse({
          content: null,
          toolCalls: [{ id: "call_mock_001", name: toolName, arguments: JSON.stringify(toolArgs) }],
          finishReason: "tool_calls",
        });
        res.end(JSON.stringify(response));
      }
    }
  } else if (isJsonRequest) {
    const jsonContent = generateMockJsonResponse(lastUserMsg);
    if (isStream) {
      writeStreamedText(res, jsonContent);
    } else {
      const response = buildChatResponse({
        content: jsonContent,
        toolCalls: undefined,
        finishReason: "stop",
      });
      res.end(JSON.stringify(response));
    }
  } else {
    const text = "Hello! I am a mock response from the test server.";
    if (isStream) {
      writeStreamedText(res, text);
    } else {
      const response = buildChatResponse({
        content: text,
        toolCalls: undefined,
        finishReason: "stop",
      });
      res.end(JSON.stringify(response));
    }
  }
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

function buildChatResponse(opts: {
  content: string | null;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  finishReason: string;
}) {
  const message: Record<string, unknown> = {
    role: "assistant",
    content: opts.content,
  };
  if (opts.toolCalls?.length) {
    message.tool_calls = opts.toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }
  return {
    id: "chatcmpl-mock-001",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "mock-model",
    choices: [{ message, finish_reason: opts.finishReason, index: 0 }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

// ---------------------------------------------------------------------------
// Streaming helpers
// ---------------------------------------------------------------------------

function writeStreamedText(res: ServerResponse, text: string) {
  const chunk1 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { role: "assistant" }, finish_reason: null, index: 0 }] };
  const chunk2 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { content: text }, finish_reason: null, index: 0 }] };
  const chunk3 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: {}, finish_reason: "stop", index: 0 }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
  res.write(`data: ${JSON.stringify(chunk1)}\n\n`);
  res.write(`data: ${JSON.stringify(chunk2)}\n\n`);
  res.write(`data: ${JSON.stringify(chunk3)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function writeStreamedToolCall(res: ServerResponse, toolName: string, toolArgs: Record<string, unknown>) {
  const chunk1 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { role: "assistant" }, finish_reason: null, index: 0 }] };
  const chunk2 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { tool_calls: [{ index: 0, id: "call_mock_001", function: { name: toolName, arguments: JSON.stringify(toolArgs) } }] }, finish_reason: null, index: 0 }] };
  const chunk3 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: {}, finish_reason: "tool_calls", index: 0 }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
  res.write(`data: ${JSON.stringify(chunk1)}\n\n`);
  res.write(`data: ${JSON.stringify(chunk2)}\n\n`);
  res.write(`data: ${JSON.stringify(chunk3)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function writeStreamedMultiToolCall(res: ServerResponse, toolName: string, argsList: Array<Record<string, unknown>>) {
  const chunk1 = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { role: "assistant" }, finish_reason: null, index: 0 }] };
  res.write(`data: ${JSON.stringify(chunk1)}\n\n`);
  for (let i = 0; i < argsList.length; i++) {
    const tc = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: { tool_calls: [{ index: i, id: `call_mock_00${i + 1}`, function: { name: toolName, arguments: JSON.stringify(argsList[i]) } }] }, finish_reason: null, index: 0 }] };
    res.write(`data: ${JSON.stringify(tc)}\n\n`);
  }
  const chunkFinal = { id: "chatcmpl-mock-stream", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "mock-model", choices: [{ delta: {}, finish_reason: "tool_calls", index: 0 }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
  res.write(`data: ${JSON.stringify(chunkFinal)}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

function findLastUserMessage(messages: MockMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content) {
      return messages[i].content;
    }
  }
  return null;
}

function generateMockToolArgs(toolName: string, userMsg: string | null): Record<string, unknown> {
  const msg = userMsg ?? "";
  const numbers = msg.match(/\d+/g)?.map(Number) ?? [];
  switch (toolName) {
    case "get_weather": {
      const cityMatch = msg.match(/(?:in|for|of)\s+(\w+)/i);
      return { city: cityMatch ? cityMatch[1] : "Paris" };
    }
    case "calculate":
      return { a: numbers[0] ?? 7, b: numbers[1] ?? 6, operator: msg.includes("multipl") ? "multiply" : msg.includes("add") ? "add" : "multiply" };
    case "get_population": {
      const cities = msg.match(/[A-Z][a-z]+/g) ?? ["Tokyo"];
      return { city: cities[0] };
    }
    default:
      return {};
  }
}

function generateMultiToolArgs(toolName: string, userMsg: string | null): Array<Record<string, unknown>> | null {
  if (!userMsg) return null;
  if (toolName === "get_population") {
    const cityPatterns = [
      { regex: /\bTokyo\b/i, city: "Tokyo" },
      { regex: /\bLondon\b/i, city: "London" },
      { regex: /\bParis\b/i, city: "Paris" },
      { regex: /\bNew\s*York\b/i, city: "New York" },
    ];
    const found = cityPatterns.filter(p => p.regex.test(userMsg));
    if (found.length >= 2) {
      return found.map(f => ({ city: f.city }));
    }
  }
  return null;
}

function generateMockJsonResponse(userMsg: string | null): string {
  const msg = userMsg ?? "";
  if (/name.*Alice/.test(msg)) {
    return JSON.stringify({ name: "Alice", age: 30 });
  }
  return JSON.stringify({ result: "mock" });
}

function generateToolResultSummary(messages: (MockMessage | MockAssistantMessage)[]): string {
  const toolResults: Array<{ name: string; args: string; result: string }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && (msg as MockAssistantMessage).tool_calls) {
      const tcs = (msg as MockAssistantMessage).tool_calls!;
      for (const tc of tcs) {
        const toolResultMsg = messages.find(
          (m, j) => j > i && m.role === "tool" && m.content && m.tool_call_id === tc.id,
        );
        toolResults.push({ name: tc.function.name, args: tc.function.arguments, result: toolResultMsg?.content ?? "" });
      }
    }
  }

  if (toolResults.length === 0) {
    return "Based on the tool results, I have the information you requested.";
  }

  const allSameTool = toolResults.every(r => r.name === toolResults[0].name);

  if (allSameTool && toolResults[0].name === "get_population") {
    const parts: string[] = [];
    for (const tr of toolResults) {
      try {
        const parsed = JSON.parse(tr.result);
        parts.push(`${parsed.city}: ${parsed.population.toLocaleString()}`);
      } catch {
        parts.push(tr.result);
      }
    }
    return `Here are the populations: ${parts.join(", ")}.`;
  }

  const summaries: string[] = [];
  for (const tr of toolResults) {
    try {
      const parsed = JSON.parse(tr.result);
      switch (tr.name) {
        case "get_weather":
          summaries.push(`The weather in ${parsed.city} is ${parsed.condition} with ${parsed.temp_c}°C.`);
          break;
        case "calculate":
          summaries.push(`The calculation result is ${parsed.result}.`);
          break;
        case "get_population":
          summaries.push(`${parsed.city} has a population of ${parsed.population.toLocaleString()}.`);
          break;
        default:
          summaries.push(`Result: ${JSON.stringify(parsed)}`);
      }
    } catch {
      summaries.push(`Result: ${tr.result}`);
    }
  }
  return summaries.join(" ");
}
