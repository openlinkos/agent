/**
 * Unit tests for DeepSeek and Qwen providers.
 *
 * Validates:
 * - Provider name and capabilities are correct
 * - Auth errors are thrown with correct provider context when no API key
 * - Base URL defaults are correct
 * - API key env var lookup works
 * - Provider extends OpenAI and reuses its generate/stream logic
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { DeepSeekProvider } from "../src/providers/deepseek.js";
import { QwenProvider } from "../src/providers/qwen.js";
import { AuthenticationError } from "../src/errors.js";
import { registerProvider, getProvider, clearProviders } from "../src/provider.js";
import { OpenAIAdapter } from "../src/adapters/openai-adapter.js";
import { createDeepSeekProvider } from "../src/providers/deepseek.js";
import { createQwenProvider } from "../src/providers/qwen.js";

// ---------------------------------------------------------------------------
// DeepSeek provider
// ---------------------------------------------------------------------------

describe("DeepSeekProvider", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = origKey;
    } else {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });

  it("has name 'deepseek'", () => {
    const provider = new DeepSeekProvider();
    expect(provider.name).toBe("deepseek");
  });

  it("extends OpenAIAdapter", () => {
    const provider = new DeepSeekProvider();
    expect(provider).toBeInstanceOf(OpenAIAdapter);
  });

  it("has correct capabilities", () => {
    const provider = new DeepSeekProvider();
    expect(provider.capabilities).toEqual({
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    });
  });

  it("throws AuthenticationError without API key", async () => {
    origKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const provider = new DeepSeekProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "deepseek-chat" },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("includes provider name in auth error", async () => {
    origKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const provider = new DeepSeekProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "deepseek-chat" },
      ),
    ).rejects.toThrow(/deepseek/i);
  });

  it("auth error has provider field set to 'deepseek'", async () => {
    origKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const provider = new DeepSeekProvider();

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "deepseek-chat" },
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).provider).toBe("deepseek");
    }
  });

  it("uses DeepSeek base URL by default", async () => {
    origKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "test-key";
    const provider = new DeepSeekProvider();

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
        { modelName: "deepseek-chat" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.deepseek.com/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("allows baseURL override", async () => {
    origKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "test-key";
    const provider = new DeepSeekProvider();

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
        { modelName: "deepseek-chat", baseURL: "https://custom.example.com/v1" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://custom.example.com/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("factory function returns DeepSeekProvider", () => {
    const provider = createDeepSeekProvider();
    expect(provider).toBeInstanceOf(DeepSeekProvider);
    expect(provider.name).toBe("deepseek");
  });

  it("can be registered in provider registry", () => {
    clearProviders();
    const provider = createDeepSeekProvider();
    registerProvider(provider);
    expect(getProvider("deepseek")).toBe(provider);
    clearProviders();
  });
});

// ---------------------------------------------------------------------------
// Qwen provider
// ---------------------------------------------------------------------------

describe("QwenProvider", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.DASHSCOPE_API_KEY = origKey;
    } else {
      delete process.env.DASHSCOPE_API_KEY;
    }
  });

  it("has name 'qwen'", () => {
    const provider = new QwenProvider();
    expect(provider.name).toBe("qwen");
  });

  it("extends OpenAIAdapter", () => {
    const provider = new QwenProvider();
    expect(provider).toBeInstanceOf(OpenAIAdapter);
  });

  it("has correct capabilities", () => {
    const provider = new QwenProvider();
    expect(provider.capabilities).toEqual({
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    });
  });

  it("throws AuthenticationError without API key", async () => {
    origKey = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const provider = new QwenProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "qwen-turbo" },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("includes provider name in auth error", async () => {
    origKey = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const provider = new QwenProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "qwen-turbo" },
      ),
    ).rejects.toThrow(/qwen/i);
  });

  it("auth error has provider field set to 'qwen'", async () => {
    origKey = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    const provider = new QwenProvider();

    try {
      await provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "qwen-turbo" },
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).provider).toBe("qwen");
    }
  });

  it("uses DashScope base URL by default", async () => {
    origKey = process.env.DASHSCOPE_API_KEY;
    process.env.DASHSCOPE_API_KEY = "test-key";
    const provider = new QwenProvider();

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
        { modelName: "qwen-turbo" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("allows baseURL override", async () => {
    origKey = process.env.DASHSCOPE_API_KEY;
    process.env.DASHSCOPE_API_KEY = "test-key";
    const provider = new QwenProvider();

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
        { modelName: "qwen-turbo", baseURL: "https://custom.example.com/v1" },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://custom.example.com/v1/chat/completions",
        expect.any(Object),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("factory function returns QwenProvider", () => {
    const provider = createQwenProvider();
    expect(provider).toBeInstanceOf(QwenProvider);
    expect(provider.name).toBe("qwen");
  });

  it("can be registered in provider registry", () => {
    clearProviders();
    const provider = createQwenProvider();
    registerProvider(provider);
    expect(getProvider("qwen")).toBe(provider);
    clearProviders();
  });
});
