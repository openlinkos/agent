/**
 * Provider abstraction for @openlinkos/ai.
 *
 * Defines the ModelProvider interface and a global provider registry.
 */

import type {
  Message,
  ModelResponse,
  ToolDefinition,
  ModelCapabilities,
  ResponseFormat,
} from "./types.js";
import type { StreamResult } from "./stream.js";

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Options passed to provider methods.
 * A subset of ModelConfig without the "model" field (already resolved).
 */
export interface ProviderRequestOptions {
  /** The model name within this provider (e.g. "gpt-4o"). */
  modelName: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
  stop?: string[];
  topP?: number;
  /** Response format specification for structured output. */
  responseFormat?: ResponseFormat;
  /** AbortSignal to cancel in-flight requests. */
  signal?: AbortSignal;
}

/**
 * Abstract interface that every LLM provider must implement.
 */
export interface ModelProvider {
  /** Unique provider identifier (e.g. "openai", "anthropic", "google"). */
  readonly name: string;

  /** Declares what this provider supports. */
  readonly capabilities: ModelCapabilities;

  /**
   * Generate a complete (non-streaming) response.
   */
  generate(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse>;

  /**
   * Generate a streaming response.
   */
  stream(
    messages: Message[],
    options: ProviderRequestOptions,
  ): Promise<StreamResult>;

  /**
   * Generate a response with tool definitions available.
   * The provider is responsible for formatting tools in the API's native format.
   */
  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: ProviderRequestOptions,
  ): Promise<ModelResponse>;
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const providers = new Map<string, ModelProvider>();

/**
 * Register a provider so it can be resolved by name.
 */
export function registerProvider(provider: ModelProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Retrieve a registered provider by name.
 *
 * @throws Error if no provider is registered under `name`.
 */
export function getProvider(name: string): ModelProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(
      `Provider "${name}" is not registered. ` +
      `Available providers: ${[...providers.keys()].join(", ") || "(none)"}`,
    );
  }
  return provider;
}

/**
 * List all registered provider names.
 */
export function listProviders(): string[] {
  return [...providers.keys()];
}

/**
 * Remove all registered providers (useful for testing).
 */
export function clearProviders(): void {
  providers.clear();
}

/**
 * Parse a "provider:model" identifier into its parts.
 *
 * @throws Error if the format is invalid.
 */
export function parseModelId(modelId: string): { provider: string; modelName: string } {
  const colonIndex = modelId.indexOf(":");
  if (colonIndex === -1 || colonIndex === 0 || colonIndex === modelId.length - 1) {
    throw new Error(
      `Invalid model identifier "${modelId}". Expected format: "provider:model" (e.g. "openai:gpt-4o").`,
    );
  }
  return {
    provider: modelId.slice(0, colonIndex),
    modelName: modelId.slice(colonIndex + 1),
  };
}
