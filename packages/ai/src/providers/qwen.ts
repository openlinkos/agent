/**
 * Qwen provider — OpenAI-compatible API via Alibaba DashScope.
 *
 * Reuses the OpenAI adapter with a different base URL and API key.
 * Supported models: qwen-turbo, qwen-plus, qwen-max.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { OpenAIAdapter } from "../adapters/openai-adapter.js";
import { AuthenticationError } from "../errors.js";

export class QwenProvider extends OpenAIAdapter {
  override readonly name = "qwen";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected getDefaultBaseURL(): string {
    return "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }

  protected getApiKeyEnvVar(): string {
    return "DASHSCOPE_API_KEY";
  }

  protected get providerLabel(): string {
    return "Qwen";
  }

  protected getEndpoint(): string {
    return "/chat/completions";
  }

  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.DASHSCOPE_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "Qwen API key is required. Set DASHSCOPE_API_KEY environment variable or pass apiKey in config.",
        { provider: "qwen" },
      );
    }
    return key;
  }
}

/**
 * Create a Qwen provider instance.
 */
export function createQwenProvider(): QwenProvider {
  return new QwenProvider();
}
