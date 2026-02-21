/**
 * DeepSeek provider — OpenAI-compatible API.
 *
 * Reuses the OpenAI adapter with a different base URL and API key.
 * Supported models: deepseek-chat, deepseek-reasoner.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { OpenAIAdapter } from "../adapters/openai-adapter.js";
import { AuthenticationError } from "../errors.js";

export class DeepSeekProvider extends OpenAIAdapter {
  override readonly name = "deepseek";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected getDefaultBaseURL(): string {
    return "https://api.deepseek.com/v1";
  }

  protected getApiKeyEnvVar(): string {
    return "DEEPSEEK_API_KEY";
  }

  protected get providerLabel(): string {
    return "DeepSeek";
  }

  protected getEndpoint(): string {
    return "/chat/completions";
  }

  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable or pass apiKey in config.",
        { provider: "deepseek" },
      );
    }
    return key;
  }
}

/**
 * Create a DeepSeek provider instance.
 */
export function createDeepSeekProvider(): DeepSeekProvider {
  return new DeepSeekProvider();
}
