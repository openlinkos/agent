/**
 * OpenAI-compatible provider implementation.
 *
 * Supports GPT-4o, GPT-4, o1, and any OpenAI-compatible API.
 * Uses the Chat Completions API.
 */

import type {
  Message,
  ModelResponse,
  ToolDefinition,
  ToolCall,
  Usage,
  ModelCapabilities,
  AssistantMessage,
} from "../types.js";
import type { ModelProvider, ProviderRequestOptions } from "../provider.js";
import type { StreamResult } from "../stream.js";
import { createStream } from "../stream.js";
import type { StreamEvent } from "../stream.js";
import {
  mapHttpError,
  AuthenticationError,
  TimeoutError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// OpenAI API types (minimal subset)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  function_call?: { name: string; arguments: string };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
      function_call?: { name: string; arguments: string };
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

function toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map((msg): OpenAIMessage => {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content };
      case "user":
        return { role: "user", content: msg.content };
      case "assistant": {
        const assistantMsg = msg as AssistantMessage;
        const result: OpenAIMessage = {
          role: "assistant",
          content: assistantMsg.content,
        };
        if (assistantMsg.toolCalls?.length) {
          result.tool_calls = assistantMsg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        return result;
      }
      case "tool":
        return {
          role: "tool",
          content: msg.content,
          tool_call_id: msg.toolCallId,
        };
    }
  });
}

function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

function parseToolCalls(toolCalls?: OpenAIToolCall[]): ToolCall[] {
  if (!toolCalls) return [];
  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }));
}

/**
 * Parse legacy function_call format into a ToolCall array.
 */
function parseFunctionCall(fc?: { name: string; arguments: string }): ToolCall[] {
  if (!fc) return [];
  return [{
    id: `fc_${Math.random().toString(36).slice(2, 11)}`,
    name: fc.name,
    arguments: JSON.parse(fc.arguments) as Record<string, unknown>,
  }];
}

function parseFinishReason(reason: string): ModelResponse["finishReason"] {
  switch (reason) {
    case "stop": return "stop";
    case "length": return "length";
    case "tool_calls": return "tool_calls";
    case "function_call": return "tool_calls";
    case "content_filter": return "content_filter";
    default: return "unknown";
  }
}

function parseUsage(usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): Usage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai";

  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemMessages: true,
    vision: true,
  };

  private getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "https://api.openai.com/v1";
  }

  private getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.",
        { provider: "openai" },
      );
    }
    return key;
  }

  async generate(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    return this.doGenerate(messages, undefined, options);
  }

  async stream(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<StreamResult> {
    const baseURL = this.getBaseURL(options);
    const apiKey = this.getApiKey(options);

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: toOpenAIMessages(messages),
      stream: true,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.stop) body.stop = options.stop;
    if (options.topP !== undefined) body.top_p = options.topP;

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, "OpenAI", response.headers);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("OpenAI streaming response has no body.");
    }

    return createStream(this.parseSSEStream(reader, options.signal));
  }

  async generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    return this.doGenerate(messages, tools, options);
  }

  private async doGenerate(
    messages: Message[],
    tools: ToolDefinition[] | undefined,
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    const baseURL = this.getBaseURL(options);
    const apiKey = this.getApiKey(options);

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: toOpenAIMessages(messages),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.stop) body.stop = options.stop;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (tools?.length) body.tools = toOpenAITools(tools);

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, "OpenAI", response.headers);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    // Handle both tool_calls and legacy function_call formats
    const toolCalls = choice.message.tool_calls
      ? parseToolCalls(choice.message.tool_calls)
      : parseFunctionCall(choice.message.function_call);

    return {
      text: choice.message.content,
      toolCalls,
      usage: parseUsage(data.usage),
      finishReason: parseFinishReason(choice.finish_reason),
    };
  }

  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = "";
    let streamTimeoutMs = 30_000;
    let lastDataTime = Date.now();

    try {
      while (true) {
        // Check abort signal
        if (signal?.aborted) {
          throw signal.reason ?? new Error("Aborted");
        }

        // Timeout check: no data for streamTimeoutMs
        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
          const remaining = streamTimeoutMs - (Date.now() - lastDataTime);
          setTimeout(() => resolve({ done: true, value: undefined }), Math.max(remaining, 0));
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);

        if (done && value === undefined && (Date.now() - lastDataTime) >= streamTimeoutMs) {
          throw new TimeoutError(`OpenAI stream timed out after ${streamTimeoutMs}ms of inactivity`);
        }
        if (done) break;

        lastDataTime = Date.now();
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          const json = trimmed.slice(6);
          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(json) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            yield { type: "text_delta", text: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                yield {
                  type: "tool_call_delta",
                  toolCall: {
                    id: tc.id,
                    name: tc.function?.name,
                  },
                };
              }
            }
          }

          if (chunk.usage) {
            yield { type: "usage", usage: parseUsage(chunk.usage) };
          }

          // Handle content_filter finish reason in stream
          const finishReason = chunk.choices?.[0]?.finish_reason;
          if (finishReason === "content_filter") {
            yield { type: "done" };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  }
}

/**
 * Create an OpenAI provider instance.
 */
export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider();
}
