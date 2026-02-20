/**
 * E2E smoke tests for DeepSeek and Qwen providers.
 *
 * These tests hit real APIs and are skipped when the corresponding
 * environment variable is not set. Run manually or via CI with secrets.
 */

import { describe, it, expect } from "vitest";
import { DeepSeekProvider } from "../../src/providers/deepseek.js";
import { QwenProvider } from "../../src/providers/qwen.js";
import { collectText } from "../../src/stream.js";

// ---------------------------------------------------------------------------
// DeepSeek
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DEEPSEEK_API_KEY)("DeepSeek E2E", () => {
  const provider = new DeepSeekProvider();
  const messages = [{ role: "user" as const, content: "Say hello in one word." }];
  const options = { modelName: "deepseek-chat" };

  it("generate returns text", async () => {
    const response = await provider.generate(messages, options);
    expect(response.text).toBeTruthy();
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  }, 30_000);

  it("stream returns text deltas", async () => {
    const stream = await provider.stream(messages, options);
    const text = await collectText(stream);
    expect(text.length).toBeGreaterThan(0);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Qwen
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DASHSCOPE_API_KEY)("Qwen E2E", () => {
  const provider = new QwenProvider();
  const messages = [{ role: "user" as const, content: "Say hello in one word." }];
  const options = { modelName: "qwen-turbo" };

  it("generate returns text", async () => {
    const response = await provider.generate(messages, options);
    expect(response.text).toBeTruthy();
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  }, 30_000);

  it("stream returns text deltas", async () => {
    const stream = await provider.stream(messages, options);
    const text = await collectText(stream);
    expect(text.length).toBeGreaterThan(0);
  }, 30_000);
});
