/**
 * @openlinkos/ai — Unified model invocation layer for LLM providers.
 *
 * Provides a single abstraction over multiple LLM providers (OpenAI, Anthropic,
 * Google Gemini) with built-in tool calling, structured output, streaming,
 * retry, and fallback support.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolCall,
  Message,
  JSONSchema,
  ToolDefinition,
  JSONResponseFormat,
  TextResponseFormat,
  ResponseFormat,
  Usage,
  ModelConfig,
  ModelResponse,
  FinishReason,
  ModelCapabilities,
} from "./types.js";

// --- Provider interface & registry ---
export type {
  ModelProvider,
  ProviderRequestOptions,
} from "./provider.js";
export {
  registerProvider,
  getProvider,
  listProviders,
  clearProviders,
  parseModelId,
} from "./provider.js";

// --- Streaming ---
export type {
  TextDelta,
  ToolCallDelta,
  UsageDelta,
  StreamDone,
  StreamEvent,
  StreamResult,
} from "./stream.js";
export {
  createStream,
  streamFromArray,
  mapStream,
  filterStream,
  tapStream,
  collectText,
  collectEvents,
} from "./stream.js";

// --- Retry & fallback ---
export type {
  RetryOptions,
  FallbackOptions,
} from "./retry.js";
export {
  withRetry,
  defaultIsRetryable,
  FallbackProvider,
  createFallback,
} from "./retry.js";

// --- Provider implementations ---
export { OpenAIProvider, createOpenAIProvider } from "./providers/openai.js";
export { AnthropicProvider, createAnthropicProvider } from "./providers/anthropic.js";
export { GoogleProvider, createGoogleProvider } from "./providers/google.js";

// ---------------------------------------------------------------------------
// Model factory
// ---------------------------------------------------------------------------

import type { Message, ModelConfig, ModelResponse, ToolDefinition } from "./types.js";
import type { StreamResult } from "./stream.js";
import { parseModelId, getProvider } from "./provider.js";

/**
 * A high-level Model interface that wraps a provider and model name.
 */
export interface Model {
  /** The full "provider:model" identifier. */
  readonly modelId: string;

  /** Generate a non-streaming response. */
  generate(messages: Message[], config?: Partial<ModelConfig>): Promise<ModelResponse>;

  /** Generate a streaming response. */
  stream(messages: Message[], config?: Partial<ModelConfig>): Promise<StreamResult>;

  /** Generate with tools available. */
  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    config?: Partial<ModelConfig>,
  ): Promise<ModelResponse>;
}

/**
 * Create a Model instance from a "provider:model" identifier.
 *
 * The provider must already be registered via `registerProvider()`.
 *
 * @param modelId - Model identifier in "provider:model" format (e.g. "openai:gpt-4o").
 * @param config - Optional default configuration.
 * @returns A Model instance.
 *
 * @example
 * ```typescript
 * import { createModel, registerProvider, createOpenAIProvider } from "@openlinkos/ai";
 *
 * registerProvider(createOpenAIProvider());
 * const model = createModel("openai:gpt-4o", { temperature: 0.7 });
 * const response = await model.generate([{ role: "user", content: "Hello!" }]);
 * ```
 */
export function createModel(modelId: string, config?: Partial<ModelConfig>): Model {
  const { provider: providerName, modelName } = parseModelId(modelId);

  return {
    modelId,

    async generate(messages: Message[], overrides?: Partial<ModelConfig>): Promise<ModelResponse> {
      const provider = getProvider(providerName);
      const merged = { ...config, ...overrides };
      return provider.generate(messages, {
        modelName,
        apiKey: merged.apiKey,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        baseURL: merged.baseURL,
        stop: merged.stop,
        topP: merged.topP,
        responseFormat: merged.responseFormat,
      });
    },

    async stream(messages: Message[], overrides?: Partial<ModelConfig>): Promise<StreamResult> {
      const provider = getProvider(providerName);
      const merged = { ...config, ...overrides };
      return provider.stream(messages, {
        modelName,
        apiKey: merged.apiKey,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        baseURL: merged.baseURL,
        stop: merged.stop,
        topP: merged.topP,
        responseFormat: merged.responseFormat,
      });
    },

    async generateWithTools(
      messages: Message[],
      tools: ToolDefinition[],
      overrides?: Partial<ModelConfig>,
    ): Promise<ModelResponse> {
      const provider = getProvider(providerName);
      const merged = { ...config, ...overrides };
      return provider.generateWithTools(messages, tools, {
        modelName,
        apiKey: merged.apiKey,
        temperature: merged.temperature,
        maxTokens: merged.maxTokens,
        baseURL: merged.baseURL,
        stop: merged.stop,
        topP: merged.topP,
        responseFormat: merged.responseFormat,
      });
    },
  };
}
