/**
 * @openlinkos/ai — Unified model invocation layer for LLM providers.
 *
 * Provides a single abstraction over multiple LLM providers (OpenAI, Anthropic,
 * Google Gemini, DeepSeek, Qwen, Ollama) with built-in tool calling, structured output,
 * streaming, retry, and fallback support.
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

// --- Stream utilities ---
export {
  backpressureStream,
  bufferUntil,
  textTransform,
  mergeStreams,
} from "./stream-utils.js";

// --- Errors ---
export type { AIErrorCode } from "./errors.js";
export {
  BaseError,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  InvalidRequestError,
  ToolExecutionError,
  GuardrailError,
  AbortError,
  mapHttpError,
} from "./errors.js";

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

// --- Rate limiter ---
export {
  TokenBucket,
  TokenBudget,
  RateLimiter,
  createRateLimitedModel,
} from "./rate-limiter.js";
export type { RateLimiterConfig } from "./rate-limiter.js";

// --- Structured output ---
export { generateObject, validateSchema } from "./structured.js";
export type {
  GenerateObjectOptions,
  GenerateObjectResult,
} from "./structured.js";

// --- Provider adapters (for extending) ---
export {
  OpenAIAdapter,
  toOpenAIMessages,
  toOpenAITools,
  parseToolCalls,
  parseFunctionCall,
  parseFinishReason,
  parseUsage,
  type OpenAIMessage,
  type OpenAIToolCall,
  type OpenAITool,
  type OpenAIChatResponse,
  type OpenAIStreamChunk,
} from "./adapters/openai-adapter.js";
export {
  AnthropicAdapter,
  toAnthropicMessages,
  toAnthropicTools,
  parseAnthropicToolCalls,
  parseAnthropicText,
  parseAnthropicFinishReason,
  parseAnthropicUsage,
  type AnthropicMessage,
  type AnthropicContent,
  type AnthropicTool,
  type AnthropicResponse,
} from "./adapters/anthropic-adapter.js";

// --- Provider implementations ---
export { OpenAIProvider, createOpenAIProvider } from "./providers/openai.js";
export { AnthropicProvider, createAnthropicProvider } from "./providers/anthropic.js";
export { GoogleProvider, createGoogleProvider } from "./providers/google.js";
export { DeepSeekProvider, createDeepSeekProvider } from "./providers/deepseek.js";
export { QwenProvider, createQwenProvider } from "./providers/qwen.js";
export { OllamaProvider, createOllamaProvider } from "./providers/ollama.js";

// --- Server ---
export { createAgentServer } from "./server.js";
export type {
  ServerAgent,
  ServerAgentResponse,
  AgentServerOptions,
} from "./server.js";

// ---------------------------------------------------------------------------
// Model factory
// ---------------------------------------------------------------------------

import type { Message, ModelConfig, ModelResponse, ToolDefinition } from "./types.js";
import type { StreamResult } from "./stream.js";
import { parseModelId, getProvider } from "./provider.js";

/**
 * Options that can be passed to Model methods alongside config overrides.
 */
export interface ModelRequestOptions {
  /** AbortSignal to cancel in-flight requests. */
  signal?: AbortSignal;
}

/**
 * A high-level Model interface that wraps a provider and model name.
 */
export interface Model {
  /** The full "provider:model" identifier. */
  readonly modelId: string;

  /** Generate a non-streaming response. */
  generate(messages: Message[], config?: Partial<ModelConfig>, options?: ModelRequestOptions): Promise<ModelResponse>;

  /** Generate a streaming response. */
  stream(messages: Message[], config?: Partial<ModelConfig>, options?: ModelRequestOptions): Promise<StreamResult>;

  /** Generate with tools available. */
  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    config?: Partial<ModelConfig>,
    options?: ModelRequestOptions,
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

  function buildOptions(merged: Partial<ModelConfig>, reqOpts?: ModelRequestOptions) {
    return {
      modelName,
      apiKey: merged.apiKey,
      temperature: merged.temperature,
      maxTokens: merged.maxTokens,
      baseURL: merged.baseURL,
      stop: merged.stop,
      topP: merged.topP,
      responseFormat: merged.responseFormat,
      signal: reqOpts?.signal,
    };
  }

  return {
    modelId,

    async generate(messages: Message[], overrides?: Partial<ModelConfig>, options?: ModelRequestOptions): Promise<ModelResponse> {
      const provider = getProvider(providerName);
      return provider.generate(messages, buildOptions({ ...config, ...overrides }, options));
    },

    async stream(messages: Message[], overrides?: Partial<ModelConfig>, options?: ModelRequestOptions): Promise<StreamResult> {
      const provider = getProvider(providerName);
      return provider.stream(messages, buildOptions({ ...config, ...overrides }, options));
    },

    async generateWithTools(
      messages: Message[],
      tools: ToolDefinition[],
      overrides?: Partial<ModelConfig>,
      options?: ModelRequestOptions,
    ): Promise<ModelResponse> {
      const provider = getProvider(providerName);
      return provider.generateWithTools(messages, tools, buildOptions({ ...config, ...overrides }, options));
    },
  };
}
