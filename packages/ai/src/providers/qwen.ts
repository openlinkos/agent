/**
 * Qwen provider — OpenAI-compatible API via Alibaba DashScope.
 *
 * Reuses the OpenAI provider with a different base URL and API key.
 * Supported models: qwen-turbo, qwen-plus, qwen-max.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { AuthenticationError } from "../errors.js";
import { OpenAIProvider } from "./openai.js";

export class QwenProvider extends OpenAIProvider {
  override readonly name = "qwen";

  override readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  protected override get providerLabel(): string {
    return "Qwen";
  }

  protected override getBaseURL(options: ProviderRequestOptions): string {
    return options.baseURL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }

  protected override getApiKey(options: ProviderRequestOptions): string {
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
