/**
 * Unit tests for Ollama provider.
 *
 * Validates:
 * - Provider name and capabilities are correct
 * - No auth error when no API key (empty string default)
 * - Base URL defaults to localhost:11434
 * - Provider extends OpenAI and reuses its generate/stream logic
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { OllamaProvider } from "../src/providers/ollama.js";
import { registerProvider, getProvider, clearProviders } from "../src/provider.js";
import { OpenAIAdapter } from "../src/adapters/openai-adapter.js";
import { createOllamaProvider } from "../src/providers/ollama.js";

describe("OllamaProvider", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.OLLAMA_API_KEY = origKey;
    } else {
      delete process.env.OLLAMA_API_KEY;
    }
  });

  it("has name 'ollama'", () => {
    const provider = new OllamaProvider();
    expect(provider.name).toBe("ollama");
  });

  it("extends OpenAIAdapter", () => {
    const provider = new OllamaProvider();
    expect(provider).toBeInstanceOf(OpenAIAdapter);
  });

  it("has correct capabilities", () => {
    const provider = new OllamaProvider();
    expect(provider.capabilities).toEqual({
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    });
  });

  it("does not throw without API key", async () => {
    origKey = process.env.OLLAMA_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    const provider = new OllamaProvider();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "test",
        choices: [{
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })),
    );

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "llama3" },
      );
      // Should succeed — no API key required
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("sends empty string as Bearer token when no key set", async () => {
    origKey = process.env.OLLAMA_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    const provider = new OllamaProvider();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "test",
        choices: [{
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })),
    );

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "llama3" },
      );
      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer ");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("uses Ollama base URL by default", async () => {
    origKey = process.env.OLLAMA_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    const provider = new OllamaProvider();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "test",
        choices: [{
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })),
    );

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "llama3" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:11434/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("allows baseURL override", async () => {
    const provider = new OllamaProvider();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "test",
        choices: [{
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })),
    );

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "llama3", baseURL: "http://remote-host:11434/v1" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://remote-host:11434/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("uses OLLAMA_API_KEY env var when set", async () => {
    origKey = process.env.OLLAMA_API_KEY;
    process.env.OLLAMA_API_KEY = "my-ollama-key";
    const provider = new OllamaProvider();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "test",
        choices: [{
          message: { role: "assistant", content: "hi" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })),
    );

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "llama3" },
      );
      const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-ollama-key");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("factory function returns OllamaProvider", () => {
    const provider = createOllamaProvider();
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("ollama");
  });

  it("can be registered in provider registry", () => {
    clearProviders();
    const provider = createOllamaProvider();
    registerProvider(provider);
    expect(getProvider("ollama")).toBe(provider);
    clearProviders();
  });
});
