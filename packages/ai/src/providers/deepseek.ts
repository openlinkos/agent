/**
 * DeepSeek provider — OpenAI-compatible API.
 *
 * Reuses the OpenAI provider with a different base URL and API key.
 * Supported models: deepseek-chat, deepseek-reasoner.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { AuthenticationError } from "../errors.js";
import { OpenAIProvider } from "./openai.js";

export class DeepSeekProvider extends OpenAIProvider {
  override readonly name = "deepseek";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected override get providerLabel(): string {
    return "DeepSeek";
  }

  protected override getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "https://api.deepseek.com/v1";
  }

  protected override getApiKey(options: ProviderRequestOptions): string {
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
