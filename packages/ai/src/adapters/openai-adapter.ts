/**
 * OpenAI-compatible Provider Adapter.
 *
 * Provides a base implementation for providers that use the OpenAI
 * Chat Completions API format (OpenAI, DeepSeek, Qwen, Ollama, etc.).
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
} from "../errors.js";

// ---------------------------------------------------------------------------
// Think-tag stripping
// ---------------------------------------------------------------------------

/**
 * Result of stripping `<think>` tags from model output.
 */
export interface StripThinkTagsResult {
  /** The text with all `<think>...</think>` blocks removed. */
  text: string;
  /** Concatenated reasoning content extracted from the blocks (null if none found). */
  reasoning: string | null;
}

/**
 * Strip `<think>...</think>` reasoning blocks from model output.
 *
 * Handles:
 * - Multiple `<think>` blocks
 * - Unclosed `<think>` tags (treats everything after the tag as reasoning)
 * - Case-insensitive matching
 * - Whitespace normalisation of the remaining text
 */
export function stripThinkTags(input: string): StripThinkTagsResult {
  const reasoningParts: string[] = [];

  // Match closed <think>...</think> blocks (case-insensitive, dotAll for newlines)
  const closedPattern = /<think>([\s\S]*?)<\/think>/gi;
  let stripped = input.replace(closedPattern, (_match, content: string) => {
    const trimmed = content.trim();
    if (trimmed) reasoningParts.push(trimmed);
    return "";
  });

  // Match unclosed <think> tag (no closing tag) — treat rest of string as reasoning
  const unclosedPattern = /<think>([\s\S]*)$/i;
  stripped = stripped.replace(unclosedPattern, (_match, content: string) => {
    const trimmed = content.trim();
    if (trimmed) reasoningParts.push(trimmed);
    return "";
  });

  return {
    text: stripped.trim(),
    reasoning: reasoningParts.length > 0 ? reasoningParts.join("\n\n") : null,
  };
}

// ---------------------------------------------------------------------------
// OpenAI API types (minimal subset)
// ---------------------------------------------------------------------------

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  function_call?: { name: string; arguments: string };
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIChatResponse {
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

export interface OpenAIStreamChunk {
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
// Configuration for the adapter
// ---------------------------------------------------------------------------

/**
 * Configuration options for the OpenAI-compatible adapter.
 */
export interface OpenAIAdapterConfig {
  /** Provider name (e.g., "openai", "deepseek"). */
  name: string;
  /** Base URL for the API. */
  baseURL: string;
  /** Environment variable name for the API key. */
  apiKeyEnvVar: string;
  /** Default model capabilities. */
  capabilities: ModelCapabilities;
  /** Provider label for error messages. */
  providerLabel: string;
  /** Whether to use the chat completions endpoint path (default: "/chat/completions"). */
  endpoint?: string;
}

// ---------------------------------------------------------------------------
// Message conversion (protected for subclasses)
// ---------------------------------------------------------------------------

/**
 * Convert internal messages to OpenAI message format.
 */
export function toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
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
          tool_call_id: (msg as ToolMessage).toolCallId,
        };
    }
  });
}

/**
 * Convert tool definitions to OpenAI tools format.
 */
export function toOpenAITools(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Parse tool calls from OpenAI response.
 */
export function parseToolCalls(toolCalls?: OpenAIToolCall[]): ToolCall[] {
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
export function parseFunctionCall(fc?: { name: string; arguments: string }): ToolCall[] {
  if (!fc) return [];
  return [{
    id: `fc_${Math.random().toString(36).slice(2, 11)}`,
    name: fc.name,
    arguments: JSON.parse(fc.arguments) as Record<string, unknown>,
  }];
}

/**
 * Parse finish reason.
 */
export function parseFinishReason(reason: string): ModelResponse["finishReason"] {
  switch (reason) {
    case "stop": return "stop";
    case "length": return "length";
    case "tool_calls": return "tool_calls";
    case "function_call": return "tool_calls";
    case "content_filter": return "content_filter";
    default: return "unknown";
  }
}

/**
 * Parse usage information.
 */
export function parseUsage(usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): Usage {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible Provider Adapter
// ---------------------------------------------------------------------------

/**
 * Abstract base class for OpenAI-compatible providers.
 *
 * Providers like OpenAI, DeepSeek, Qwen, Ollama, and any other service
 * that implements the OpenAI Chat Completions API can extend this class.
 */
export abstract class OpenAIAdapter implements ModelProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ModelCapabilities;

  /**
   * Get the base URL for API requests.
   * Subclasses can override to provide custom defaults.
   */
  protected getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? this.getDefaultBaseURL();
  }

  /**
   * Get the default base URL. Subclasses must implement.
   */
  protected abstract getDefaultBaseURL(): string;

  /**
   * Get the API key from options or environment.
   * Subclasses can override to use different env vars.
   */
  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? this.getApiKeyFromEnv();
    if (!key && this.requiresApiKey()) {
      throw new AuthenticationError(
        `${this.providerLabel} API key is required. Set ${this.getApiKeyEnvVar()} environment variable or pass apiKey in config.`,
        { provider: this.name },
      );
    }
    return key ?? "";
  }

  /**
   * Get the environment variable name for the API key.
   * Subclasses can override.
   */
  protected getApiKeyEnvVar(): string {
    return `${this.name.toUpperCase()}_API_KEY`;
  }

  /**
   * Get the API key from environment variable.
   */
  protected getApiKeyFromEnv(): string | undefined {
    return process.env[this.getApiKeyEnvVar()];
  }

  /**
   * Whether the API key is required for this provider.
   * Subclasses can override to allow empty API key (e.g., Ollama).
   */
  protected requiresApiKey(): boolean {
    return true;
  }

  /**
   * Provider label for error messages.
   * Subclasses can override.
   */
  protected get providerLabel(): string {
    return this.name;
  }

  /**
   * Get the API endpoint path.
   * Subclasses can override.
   */
  protected getEndpoint(): string {
    return "/chat/completions";
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
    const endpoint = this.getEndpoint();

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: toOpenAIMessages(messages),
      stream: true,
    };
    this.applyOptions(body, options);

    const response = await fetch(`${baseURL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(apiKey),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, this.providerLabel, response.headers);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`${this.providerLabel} streaming response has no body.`);
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

  /**
   * Apply request options to the body.
   * Subclasses can override to add custom options.
   */
  protected applyOptions(body: Record<string, unknown>, options: ProviderRequestOptions): void {
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.stop) body.stop = options.stop;
    if (options.topP !== undefined) body.top_p = options.topP;
  }

  /**
   * Get HTTP headers for API requests.
   * Subclasses can override to add custom headers.
   */
  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /**
   * Execute the generate request.
   */
  protected async doGenerate(
    messages: Message[],
    tools: ToolDefinition[] | undefined,
    options: ProviderRequestOptions,
  ): Promise<ModelResponse> {
    const baseURL = this.getBaseURL(options);
    const apiKey = this.getApiKey(options);
    const endpoint = this.getEndpoint();

    const body: Record<string, unknown> = {
      model: options.modelName,
      messages: toOpenAIMessages(messages),
    };
    this.applyOptions(body, options);
    if (tools?.length) body.tools = toOpenAITools(tools);

    const response = await fetch(`${baseURL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(apiKey),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, this.providerLabel, response.headers);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    // Handle both tool_calls and legacy function_call formats
    const toolCalls = choice.message.tool_calls
      ? parseToolCalls(choice.message.tool_calls)
      : parseFunctionCall(choice.message.function_call);

    // Strip <think> reasoning tags from response text
    const rawText = choice.message.content;
    let text: string | null = rawText;
    let reasoning: string | null = null;
    if (rawText) {
      const result = stripThinkTags(rawText);
      text = result.text || null;
      reasoning = result.reasoning;
    }

    return {
      text,
      toolCalls,
      usage: parseUsage(data.usage),
      finishReason: parseFinishReason(choice.finish_reason),
      ...(reasoning != null ? { reasoning } : {}),
    };
  }

  /**
   * Parse SSE stream from the API, stripping `<think>` tags and emitting
   * their contents as `reasoning_delta` events.
   */
  protected async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = "";
    const streamTimeoutMs = 30_000;
    let lastDataTime = Date.now();

    // Think-tag streaming state
    let insideThink = false;
    // Pending text that might contain a partial "<think" or "</think" tag
    let pendingText = "";

    /**
     * Process accumulated text, splitting it into text_delta and
     * reasoning_delta events based on <think>...</think> boundaries.
     */
    function* flushText(text: string): Generator<StreamEvent> {
      pendingText += text;

      while (pendingText.length > 0) {
        if (insideThink) {
          // Look for closing </think> tag
          const closeIdx = pendingText.toLowerCase().indexOf("</think>");
          if (closeIdx !== -1) {
            // Emit everything before the close tag as reasoning
            const reasoning = pendingText.slice(0, closeIdx);
            if (reasoning) {
              yield { type: "reasoning_delta", text: reasoning };
            }
            pendingText = pendingText.slice(closeIdx + "</think>".length);
            insideThink = false;
          } else {
            // Might have a partial "</think" at the end — keep it pending
            const partialClose = findPartialTag(pendingText, "</think>");
            if (partialClose > 0) {
              const safe = pendingText.slice(0, pendingText.length - partialClose);
              if (safe) {
                yield { type: "reasoning_delta", text: safe };
              }
              pendingText = pendingText.slice(pendingText.length - partialClose);
            } else {
              // All content is reasoning
              yield { type: "reasoning_delta", text: pendingText };
              pendingText = "";
            }
            break;
          }
        } else {
          // Look for opening <think> tag
          const openIdx = pendingText.toLowerCase().indexOf("<think>");
          if (openIdx !== -1) {
            // Emit everything before the open tag as text
            const before = pendingText.slice(0, openIdx);
            if (before) {
              yield { type: "text_delta", text: before };
            }
            pendingText = pendingText.slice(openIdx + "<think>".length);
            insideThink = true;
          } else {
            // Might have a partial "<think" at the end — keep it pending
            const partialOpen = findPartialTag(pendingText, "<think>");
            if (partialOpen > 0) {
              const safe = pendingText.slice(0, pendingText.length - partialOpen);
              if (safe) {
                yield { type: "text_delta", text: safe };
              }
              pendingText = pendingText.slice(pendingText.length - partialOpen);
            } else {
              yield { type: "text_delta", text: pendingText };
              pendingText = "";
            }
            break;
          }
        }
      }
    }

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
          throw new TimeoutError(`${this.providerLabel} stream timed out after ${streamTimeoutMs}ms of inactivity`);
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
            yield* flushText(delta.content);
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
            // Flush any remaining pending text
            if (pendingText) {
              const eventType = insideThink ? "reasoning_delta" : "text_delta";
              yield { type: eventType, text: pendingText } as StreamEvent;
              pendingText = "";
            }
            yield { type: "done" };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Flush any remaining pending text at end of stream
    if (pendingText) {
      const eventType = insideThink ? "reasoning_delta" : "text_delta";
      yield { type: eventType, text: pendingText } as StreamEvent;
    }

    yield { type: "done" };
  }
}

/**
 * Check if the end of `text` contains a partial (prefix) match
 * for `tag`. Returns the length of the partial match, or 0.
 */
function findPartialTag(text: string, tag: string): number {
  const lower = text.toLowerCase();
  // Check decreasing suffix lengths of the tag
  for (let len = tag.length - 1; len >= 1; len--) {
    if (lower.endsWith(tag.slice(0, len).toLowerCase())) {
      return len;
    }
  }
  return 0;
}
