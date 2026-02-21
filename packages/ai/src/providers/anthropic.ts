/**
 * Anthropic Messages API provider implementation.
 *
 * Supports Claude models via the Anthropic Messages API.
 *
 * This provider extends the AnthropicAdapter for code reuse.
 */

import type { ModelCapabilities } from "../types.js";
import type { ProviderRequestOptions } from "../provider.js";
import { AnthropicAdapter } from "../adapters/anthropic-adapter.js";
import { AuthenticationError } from "../errors.js";

export class AnthropicProvider extends AnthropicAdapter {
  readonly name: string = "anthropic";

  readonly capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemMessages: true,
    vision: true,
  };

  protected getDefaultBaseURL(): string {
    return "https://api.anthropic.com";
  }

  protected getApiKeyEnvVar(): string {
    return "ANTHROPIC_API_KEY";
  }

  protected get providerLabel(): string {
    return "Anthropic";
  }

  protected getAnthropicVersion(): string {
    return "2023-06-01";
  }

  protected getEndpoint(): string {
    return "/v1/messages";
  }

  protected getDefaultMaxTokens(): number {
    return 4096;
  }

  protected getApiKey(options: ProviderRequestOptions): string {
    const key = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AuthenticationError(
        "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.",
        { provider: "anthropic" },
      );
    }
    return key;
  }
}

/**
 * Create an Anthropic provider instance.
 */
export function createAnthropicProvider(): AnthropicProvider {
  return new AnthropicProvider();
}
