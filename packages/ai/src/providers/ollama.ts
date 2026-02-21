/**
 * Ollama provider — OpenAI-compatible API via local Ollama server.
 *
 * Reuses the OpenAI adapter with a different base URL and no API key required.
 * Supported models: llama3, mistral, codellama, and any model available in Ollama.
 */

import type { ModelCapabilities } from "../types.js";
import { OpenAIAdapter } from "../adapters/openai-adapter.js";

export class OllamaProvider extends OpenAIAdapter {
  override readonly name = "ollama";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected getDefaultBaseURL(): string {
    return "http://localhost:11434/v1";
  }

  protected getApiKeyEnvVar(): string {
    return "OLLAMA_API_KEY";
  }

  protected get providerLabel(): string {
    return "Ollama";
  }

  protected getEndpoint(): string {
    return "/chat/completions";
  }

  // Ollama does not require an API key
  protected override requiresApiKey(): boolean {
    return false;
  }
}

/**
 * Create an Ollama provider instance.
 */
export function createOllamaProvider(): OllamaProvider {
  return new OllamaProvider();
}
