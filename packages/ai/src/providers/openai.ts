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

// ---------------------------------------------------------------------------
// OpenAI API types (minimal subset)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
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

function parseFinishReason(reason: string): ModelResponse["finishReason"] {
  switch (reason) {
    case "stop": return "stop";
    case "length": return "length";
    case "tool_calls": return "tool_calls";
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
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.",
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
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("OpenAI streaming response has no body.");
    }

    return createStream(this.parseSSEStream(reader));
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
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    return {
      text: choice.message.content,
      toolCalls: parseToolCalls(choice.message.tool_calls),
      usage: parseUsage(data.usage),
      finishReason: parseFinishReason(choice.finish_reason),
    };
  }

  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
                    arguments: tc.function?.arguments
                      ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
                      : undefined,
                  },
                };
              }
            }
          }

          if (chunk.usage) {
            yield { type: "usage", usage: parseUsage(chunk.usage) };
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
