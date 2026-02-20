/**
 * Ollama provider — OpenAI-compatible API via local Ollama server.
 *
 * Reuses the OpenAI provider with a different base URL and no API key required.
 * Supported models: llama3, mistral, codellama, and any model available in Ollama.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { OpenAIProvider } from "./openai.js";

export class OllamaProvider extends OpenAIProvider {
  override readonly name = "ollama";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected override get providerLabel(): string {
    return "Ollama";
  }

  protected override getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "http://localhost:11434/v1";
  }

  protected override getApiKey(options: ProviderRequestOptions): string {
    return options.apiKey ?? process.env.OLLAMA_API_KEY ?? "";
  }
}

/**
 * Create an Ollama provider instance.
 */
export function createOllamaProvider(): OllamaProvider {
  return new OllamaProvider();
}
