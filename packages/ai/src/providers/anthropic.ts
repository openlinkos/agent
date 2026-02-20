/**
 * Anthropic Messages API provider implementation.
 *
 * Supports Claude models via the Anthropic Messages API.
 */

import type {
  Message,
  ModelResponse,
  ToolDefinition,
  ToolCall,
  Usage,
  ModelCapabilities,
  AssistantMessage,
  ToolMessage,
} from "../types.js";
import type { ModelProvider, ProviderRequestOptions } from "../provider.js";
import type { StreamResult } from "../stream.js";
import { createStream } from "../stream.js";
import type { StreamEvent } from "../stream.js";
import {
  mapHttpError,
  AuthenticationError,
  TimeoutError,
  RateLimitError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Anthropic API types (minimal subset)
// ---------------------------------------------------------------------------

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContent[];
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContent[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  index?: number;
  content_block?: AnthropicContent;
  message?: AnthropicResponse;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

function toAnthropicMessages(
  messages: Message[],
): { system: string | undefined; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        system = msg.content;
        break;

      case "user":
        anthropicMessages.push({
          role: "user",
          content: [{ type: "text", text: msg.content }],
        });
        break;

      case "assistant": {
        const assistantMsg = msg as AssistantMessage;
        const content: AnthropicContent[] = [];
        if (assistantMsg.content) {
          content.push({ type: "text", text: assistantMsg.content });
        }
        if (assistantMsg.toolCalls) {
          for (const tc of assistantMsg.toolCalls) {
            content.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }
        if (content.length > 0) {
          anthropicMessages.push({ role: "assistant", content });
        }
        break;
      }

      case "tool": {
        const toolMsg = msg as ToolMessage;
        // Tool results must be in a user message for Anthropic
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolMsg.toolCallId,
              content: toolMsg.content,
            },
          ],
        });
        break;
      }
    }
  }

  return { system, messages: anthropicMessages };
}

function toAnthropicTools(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function parseAnthropicToolCalls(content: AnthropicContent[]): ToolCall[] {
  return content
    .filter((c): c is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      c.type === "tool_use",
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      arguments: c.input,
    }));
}

function parseAnthropicText(content: AnthropicContent[]): string | null {
  const textBlocks = content.filter(
    (c): c is { type: "text"; text: string } => c.type === "text",
  );
  if (textBlocks.length === 0) return null;
  return textBlocks.map((c) => c.text).join("");
}

function parseAnthropicFinishReason(reason: string): ModelResponse["finishReason"] {
  switch (reason) {
    case "end_turn": return "stop";
    case "max_tokens": return "length";
    case "tool_use": return "tool_calls";
    case "stop_sequence": return "stop";
    default: return "unknown";
  }
}

function parseAnthropicUsage(usage: { input_tokens: number; output_tokens: number }): Usage {
  return {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
    totalTokens: usage.input_tokens + usage.output_tokens,
  };
}

/**
 * Parse Anthropic rate limit headers.
 */
function parseRateLimitHeaders(headers: Headers): { retryAfter?: number } {
  // Anthropic sends x-ratelimit-limit-requests, x-ratelimit-remaining-requests,
  // x-ratelimit-reset-requests, and similar for tokens
  const resetRequests = headers.get("x-ratelimit-reset-requests");
  const retryAfter = headers.get("retry-after");

  let retryAfterSec: number | undefined;

  if (retryAfter) {
    const parsed = Number(retryAfter);
    if (Number.isFinite(parsed)) retryAfterSec = parsed;
  } else if (resetRequests) {
    // Parse duration like "1s", "500ms"
    const match = resetRequests.match(/^(\d+(?:\.\d+)?)(s|ms)?$/);
    if (match) {
      const value = parseFloat(match[1]);
      retryAfterSec = match[2] === "ms" ? value / 1000 : value;
    }
  }

  return { retryAfter: retryAfterSec };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";

  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemMessages: true,
    vision: true,
  };

  private getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "https://api.anthropic.com";
  }

  private getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.",
        { provider: "anthropic" },
      );
    }
    return key;
  }

  private handleErrorResponse(status: number, body: string, headers: Headers): never {
    if (status === 429) {
      const { retryAfter } = parseRateLimitHeaders(headers);
      throw new RateLimitError(
        `Anthropic rate limit exceeded (429): ${body}`,
        { retryAfter, provider: "anthropic" },
      );
    }
    throw mapHttpError(status, body, "Anthropic", headers);
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
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: anthropicMessages,
      stream: true,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.stop) body.stop_sequences = options.stop;
    if (options.topP !== undefined) body.top_p = options.topP;

    const response = await fetch(`${baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      this.handleErrorResponse(response.status, errText, response.headers);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Anthropic streaming response has no body.");
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
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: anthropicMessages,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (system) body.system = system;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.stop) body.stop_sequences = options.stop;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (tools?.length) body.tools = toAnthropicTools(tools);

    const response = await fetch(`${baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      this.handleErrorResponse(response.status, errText, response.headers);
    }

    const data = (await response.json()) as AnthropicResponse;

    return {
      text: parseAnthropicText(data.content),
      toolCalls: parseAnthropicToolCalls(data.content),
      usage: parseAnthropicUsage(data.usage),
      finishReason: parseAnthropicFinishReason(data.stop_reason),
    };
  }

  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = "";
    let currentToolCallId: string | undefined;
    const streamTimeoutMs = 30_000;
    let lastDataTime = Date.now();

    try {
      while (true) {
        // Check abort signal
        if (signal?.aborted) {
          throw signal.reason ?? new Error("Aborted");
        }

        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
          const remaining = streamTimeoutMs - (Date.now() - lastDataTime);
          setTimeout(() => resolve({ done: true, value: undefined }), Math.max(remaining, 0));
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);

        if (done && value === undefined && (Date.now() - lastDataTime) >= streamTimeoutMs) {
          throw new TimeoutError(`Anthropic stream timed out after ${streamTimeoutMs}ms of inactivity`);
        }
        if (done) break;

        lastDataTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const json = trimmed.slice(6);
          let event: AnthropicStreamEvent;
          try {
            event = JSON.parse(json) as AnthropicStreamEvent;
          } catch {
            continue;
          }

          if (event.type === "content_block_start" && event.content_block) {
            if (event.content_block.type === "tool_use") {
              currentToolCallId = event.content_block.id;
              yield {
                type: "tool_call_delta",
                toolCall: {
                  id: event.content_block.id,
                  name: event.content_block.name,
                },
              };
            }
          }

          if (event.type === "content_block_delta" && event.delta) {
            if (event.delta.type === "text_delta" && event.delta.text) {
              yield { type: "text_delta", text: event.delta.text };
            }
            if (event.delta.type === "input_json_delta" && event.delta.partial_json && currentToolCallId) {
              yield {
                type: "tool_call_delta",
                toolCall: { id: currentToolCallId },
              };
            }
          }

          if (event.type === "message_delta" && event.usage) {
            const inputTokens = event.usage.input_tokens ?? 0;
            const outputTokens = event.usage.output_tokens ?? 0;
            yield {
              type: "usage",
              usage: {
                promptTokens: inputTokens,
                completionTokens: outputTokens,
                totalTokens: inputTokens + outputTokens,
              },
            };
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
 * Create an Anthropic provider instance.
 */
export function createAnthropicProvider(): AnthropicProvider {
  return new AnthropicProvider();
}
