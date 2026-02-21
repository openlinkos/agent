/**
 * OpenAI-compatible provider implementation.
 *
 * Supports GPT-4o, GPT-4, o1, and any OpenAI-compatible API.
 * Uses the Chat Completions API.
 *
 * This provider extends the OpenAIAdapter for code reuse.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { OpenAIAdapter } from "../adapters/openai-adapter.js";
import { AuthenticationError } from "../errors.js";

export class OpenAIProvider extends OpenAIAdapter {
  readonly name: string = "openai";

  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemMessages: true,
    vision: true,
  };

  protected getDefaultBaseURL(): string {
    return "https://api.openai.com/v1";
  }

  protected getApiKeyEnvVar(): string {
    return "OPENAI_API_KEY";
  }

  protected get providerLabel(): string {
    return "OpenAI";
  }

  protected getEndpoint(): string {
    return "/chat/completions";
  }

  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.",
        { provider: "openai" },
      );
    }
    return key;
  }
}

/**
 * Create an OpenAI provider instance.
 */
export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider();
}
