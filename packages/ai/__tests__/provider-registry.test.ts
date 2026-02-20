/**
 * Tests for the provider registry.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerProvider,
  getProvider,
  listProviders,
  clearProviders,
  parseModelId,
} from "../src/provider.js";
import type { ModelProvider, ProviderRequestOptions } from "../src/provider.js";
import type { Message, ModelResponse, ModelCapabilities } from "../src/types.js";
import type { StreamResult } from "../src/stream.js";
import { streamFromArray } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

function createMockProvider(name: string): ModelProvider {
  const capabilities: ModelCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: false,
    systemMessages: true,
    vision: false,
  };

  return {
    name,
    capabilities,
    async generate(_messages: Message[], _options: ProviderRequestOptions): Promise<ModelResponse> {
      return {
        text: `Response from ${name}`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
    async stream(_messages: Message[], _options: ProviderRequestOptions): Promise<StreamResult> {
      return streamFromArray([
        { type: "text_delta", text: "Hello" },
        { type: "done" },
      ]);
    },
    async generateWithTools(_messages, _tools, _options): Promise<ModelResponse> {
      return {
        text: "Tool response",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Provider Registry", () => {
  beforeEach(() => {
    clearProviders();
  });

  describe("registerProvider", () => {
    it("should register a provider", () => {
      const provider = createMockProvider("test-provider");
      registerProvider(provider);
      expect(listProviders()).toContain("test-provider");
    });

    it("should allow registering multiple providers", () => {
      registerProvider(createMockProvider("alpha"));
      registerProvider(createMockProvider("beta"));
      expect(listProviders()).toEqual(["alpha", "beta"]);
    });
  });

  describe("getProvider", () => {
    it("should retrieve a registered provider", () => {
      const provider = createMockProvider("my-provider");
      registerProvider(provider);
      const result = getProvider("my-provider");
      expect(result.name).toBe("my-provider");
    });

    it("should throw for unregistered provider", () => {
      expect(() => getProvider("nonexistent")).toThrow(
        'Provider "nonexistent" is not registered',
      );
    });

    it("should list available providers in error message", () => {
      registerProvider(createMockProvider("openai"));
      registerProvider(createMockProvider("anthropic"));
      expect(() => getProvider("google")).toThrow("openai, anthropic");
    });
  });

  describe("listProviders", () => {
    it("should return empty array when no providers registered", () => {
      expect(listProviders()).toEqual([]);
    });

    it("should return all registered provider names", () => {
      registerProvider(createMockProvider("a"));
      registerProvider(createMockProvider("b"));
      registerProvider(createMockProvider("c"));
      expect(listProviders()).toEqual(["a", "b", "c"]);
    });
  });

  describe("clearProviders", () => {
    it("should remove all providers", () => {
      registerProvider(createMockProvider("test"));
      expect(listProviders()).toHaveLength(1);
      clearProviders();
      expect(listProviders()).toHaveLength(0);
    });
  });

  describe("provider generate", () => {
    it("should generate a response", async () => {
      const provider = createMockProvider("test");
      registerProvider(provider);
      const p = getProvider("test");
      const response = await p.generate(
        [{ role: "user", content: "Hello" }],
        { modelName: "test-model" },
      );
      expect(response.text).toBe("Response from test");
      expect(response.usage.totalTokens).toBe(15);
    });
  });
});

describe("parseModelId", () => {
  it("should parse valid model identifiers", () => {
    expect(parseModelId("openai:gpt-4o")).toEqual({
      provider: "openai",
      modelName: "gpt-4o",
    });
    expect(parseModelId("anthropic:claude-sonnet-4-5")).toEqual({
      provider: "anthropic",
      modelName: "claude-sonnet-4-5",
    });
    expect(parseModelId("google:gemini-pro")).toEqual({
      provider: "google",
      modelName: "gemini-pro",
    });
  });

  it("should handle model names with colons", () => {
    const result = parseModelId("custom:my:model:name");
    expect(result.provider).toBe("custom");
    expect(result.modelName).toBe("my:model:name");
  });

  it("should throw for invalid formats", () => {
    expect(() => parseModelId("invalid")).toThrow("Invalid model identifier");
    expect(() => parseModelId(":model")).toThrow("Invalid model identifier");
    expect(() => parseModelId("provider:")).toThrow("Invalid model identifier");
    expect(() => parseModelId("")).toThrow("Invalid model identifier");
  });
});
