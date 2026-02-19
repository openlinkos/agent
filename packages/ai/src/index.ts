/**
 * @openlinkos/ai — Unified model invocation layer for LLM providers.
 *
 * Provides a single abstraction over multiple LLM providers (OpenAI, Anthropic,
 * Google Gemini, Ollama) with built-in tool calling, structured output, and
 * streaming support.
 *
 * @packageDocumentation
 */

export interface ModelConfig {
  /** Model identifier in "provider:model" format (e.g., "openai:gpt-4o"). */
  model: string;
  /** Optional API key override. Defaults to environment variable. */
  apiKey?: string;
  /** Sampling temperature (0-2). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ModelResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Model {
  generate(messages: Message[], config?: Partial<ModelConfig>): Promise<ModelResponse>;
}

/**
 * Create a model instance from a provider:model identifier string.
 *
 * @param modelId - Model identifier in "provider:model" format.
 * @param config - Optional model configuration overrides.
 * @returns A Model instance.
 *
 * @example
 * ```typescript
 * const model = createModel("openai:gpt-4o");
 * const response = await model.generate([
 *   { role: "user", content: "Hello!" }
 * ]);
 * ```
 */
export function createModel(modelId: string, config?: Partial<ModelConfig>): Model {
  const [provider, modelName] = modelId.split(":");
  if (!provider || !modelName) {
    throw new Error(
      `Invalid model identifier "${modelId}". Expected format: "provider:model" (e.g., "openai:gpt-4o").`
    );
  }

  return {
    async generate(_messages: Message[], _config?: Partial<ModelConfig>): Promise<ModelResponse> {
      throw new Error(
        `Provider "${provider}" is not yet implemented. This is a scaffold — provider implementations are coming in Phase 1.`
      );
    },
  };
}
