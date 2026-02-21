/**
 * Google Gemini Provider Adapter.
 *
 * Provides a base implementation for providers that use the Google
 * Gemini API format (Google Generative AI).
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
// Gemini API types (minimal subset)
// ---------------------------------------------------------------------------

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string } } };

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

interface GeminiSafetyRating {
  category: string;
  probability: string;
  blocked?: boolean;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: GeminiPart[];
      role: "model";
    };
    finishReason: string;
    safetyRatings?: GeminiSafetyRating[];
    citationMetadata?: {
      citationSources?: Array<{
        startIndex?: number;
        endIndex?: number;
        uri?: string;
        license?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

function toGeminiContents(
  messages: Message[],
): { systemInstruction: string | undefined; contents: GeminiContent[] } {
  let systemInstruction: string | undefined;
  const contents: GeminiContent[] = [];
  let pendingToolResults: GeminiPart[] = [];

  function flushToolResults() {
    if (pendingToolResults.length > 0) {
      contents.push({ role: "user", parts: [...pendingToolResults] });
      pendingToolResults = [];
    }
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        systemInstruction = msg.content;
        break;

      case "user":
        flushToolResults();
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
        break;

      case "assistant": {
        flushToolResults();
        const assistantMsg = msg as AssistantMessage;
        const parts: GeminiPart[] = [];
        if (assistantMsg.content) {
          parts.push({ text: assistantMsg.content });
        }
        if (assistantMsg.toolCalls) {
          for (const tc of assistantMsg.toolCalls) {
            parts.push({
              functionCall: { name: tc.name, args: tc.arguments },
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: "model", parts });
        }
        break;
      }

      case "tool": {
        const toolMsg = msg as ToolMessage;
        pendingToolResults.push({
          functionResponse: {
            name: toolMsg.toolCallId,
            response: { content: toolMsg.content },
          },
        });
        break;
      }
    }
  }

  flushToolResults();
  return { systemInstruction, contents };
}

function toGeminiTools(tools: ToolDefinition[]): GeminiTool[] {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

function parseGeminiToolCalls(parts: GeminiPart[]): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const part of parts) {
    if ("functionCall" in part) {
      calls.push({
        id: `call_${Math.random().toString(36).slice(2, 11)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args,
      });
    }
  }
  return calls;
}

function parseGeminiText(parts: GeminiPart[]): string | null {
  const texts: string[] = [];
  for (const part of parts) {
    if ("text" in part) {
      texts.push(part.text);
    }
  }
  return texts.length > 0 ? texts.join("") : null;
}

function parseGeminiFinishReason(reason: string): ModelResponse["finishReason"] {
  switch (reason) {
    case "STOP": return "stop";
    case "MAX_TOKENS": return "length";
    case "SAFETY": return "content_filter";
    case "TOOL_CALLS": return "tool_calls";
    default: return "unknown";
  }
}

function parseGeminiUsage(usage?: GeminiResponse["usageMetadata"]): Usage {
  return {
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
    totalTokens: usage?.totalTokenCount ?? 0,
  };
}

function isSafetyBlocked(ratings?: GeminiSafetyRating[]): boolean {
  if (!ratings) return false;
  return ratings.some((r) => r.blocked === true || r.probability === "HIGH");
}

// ---------------------------------------------------------------------------
// Google Gemini Provider
// ---------------------------------------------------------------------------

export class GoogleProvider implements ModelProvider {
  readonly name = "google";

  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemMessages: true,
    vision: true,
  };

  protected getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "Google API key is required. Set GOOGLE_API_KEY environment variable or pass apiKey in config.",
        { provider: "google" },
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
    const { systemInstruction, contents } = toGeminiContents(messages);

    const body: Record<string, unknown> = { contents };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (options.temperature !== undefined) {
      body.generationConfig = { ...((body.generationConfig as Record<string, unknown>) ?? {}), temperature: options.temperature };
    }
    if (options.maxTokens !== undefined) {
      body.generationConfig = { ...((body.generationConfig as Record<string, unknown>) ?? {}), maxOutputTokens: options.maxTokens };
    }
    if (options.topP !== undefined) {
      body.generationConfig = { ...((body.generationConfig as Record<string, unknown>) ?? {}), topP: options.topP };
    }
    if (options.stop) {
      body.generationConfig = { ...((body.generationConfig as Record<string, unknown>) ?? {}), stopSequences: options.stop };
    }

    const url = `${baseURL}/models/${options.modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, "Google", response.headers);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Google streaming response has no body.");
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
    const { systemInstruction, contents } = toGeminiContents(messages);

    const body: Record<string, unknown> = { contents };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (tools?.length) body.tools = toGeminiTools(tools);

    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
    if (options.topP !== undefined) generationConfig.topP = options.topP;
    if (options.stop) generationConfig.stopSequences = options.stop;
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

    const url = `${baseURL}/models/${options.modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw mapHttpError(response.status, errText, "Google", response.headers);
    }

    const data = (await response.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];

    if (!candidate || isSafetyBlocked(candidate.safetyRatings)) {
      return {
        text: null,
        toolCalls: [],
        usage: parseGeminiUsage(data.usageMetadata),
        finishReason: "content_filter",
      };
    }

    return {
      text: parseGeminiText(candidate.content.parts),
      toolCalls: parseGeminiToolCalls(candidate.content.parts),
      usage: parseGeminiUsage(data.usageMetadata),
      finishReason: parseGeminiFinishReason(candidate.finishReason),
    };
  }

  private async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = "";
    const streamTimeoutMs = 30_000;
    let lastDataTime = Date.now();

    try {
      while (true) {
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
          throw new TimeoutError(`Google stream timed out after ${streamTimeoutMs}ms of inactivity`);
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
          let data: GeminiResponse;
          try {
            data = JSON.parse(json) as GeminiResponse;
          } catch {
            continue;
          }

          const candidate = data.candidates?.[0];

          if (candidate && isSafetyBlocked(candidate.safetyRatings)) {
            yield { type: "done" };
            return;
          }

          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if ("text" in part) {
                yield { type: "text_delta", text: part.text };
              }
              if ("functionCall" in part) {
                yield {
                  type: "tool_call_delta",
                  toolCall: {
                    id: `call_${Math.random().toString(36).slice(2, 11)}`,
                    name: part.functionCall.name,
                    arguments: part.functionCall.args,
                  },
                };
              }
            }
          }

          if (data.usageMetadata) {
            yield { type: "usage", usage: parseGeminiUsage(data.usageMetadata) };
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
 * Create a Google (Gemini) provider instance.
 */
export function createGoogleProvider(): GoogleProvider {
  return new GoogleProvider();
}
