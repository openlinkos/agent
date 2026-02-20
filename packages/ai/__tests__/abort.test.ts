/**
 * Tests for AbortController / AbortSignal support at the provider and model
 * factory levels.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createModel,
  registerProvider,
  clearProviders,
} from "../src/index.js";
import type { ModelRequestOptions } from "../src/index.js";
import type { ModelProvider, ProviderRequestOptions } from "../src/provider.js";
import type { Message, ModelResponse } from "../src/types.js";
import { streamFromArray } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_RESPONSE: ModelResponse = {
  text: "test",
  toolCalls: [],
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  finishReason: "stop",
};

const SIMPLE_MESSAGES: Message[] = [{ role: "user", content: "hello" }];

const SIMPLE_TOOL = {
  name: "greet",
  description: "Greets a user",
  parameters: { type: "object", properties: { name: { type: "string" } } },
};

/**
 * Create a mock provider that optionally captures `ProviderRequestOptions`
 * and can be overridden per-method.
 */
function createMockProvider(
  overrides?: Partial<ModelProvider>,
): ModelProvider {
  return {
    name: "test",
    capabilities: {
      streaming: true,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    },
    async generate(_msgs: Message[], _options: ProviderRequestOptions): Promise<ModelResponse> {
      return { ...MOCK_RESPONSE };
    },
    async stream(_msgs: Message[], _options: ProviderRequestOptions) {
      return streamFromArray([{ type: "done" as const }]);
    },
    async generateWithTools(
      _msgs: Message[],
      _tools,
      _options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      return { ...MOCK_RESPONSE };
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AbortController / AbortSignal support", () => {
  beforeEach(() => {
    clearProviders();
  });

  // -----------------------------------------------------------------------
  // 1. Model.generate with a pre-aborted signal
  // -----------------------------------------------------------------------
  describe("Model.generate with aborted signal", () => {
    it("should reject when signal is already aborted", async () => {
      const provider = createMockProvider({
        async generate(_msgs, options) {
          // Respect the signal: if already aborted, throw
          if (options.signal?.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();
      controller.abort();

      await expect(
        model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal }),
      ).rejects.toThrow("aborted");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Model.stream with a pre-aborted signal
  // -----------------------------------------------------------------------
  describe("Model.stream with aborted signal", () => {
    it("should reject when signal is already aborted", async () => {
      const provider = createMockProvider({
        async stream(_msgs, options) {
          if (options.signal?.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          return streamFromArray([{ type: "done" as const }]);
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();
      controller.abort();

      await expect(
        model.stream(SIMPLE_MESSAGES, {}, { signal: controller.signal }),
      ).rejects.toThrow("aborted");
    });
  });

  // -----------------------------------------------------------------------
  // 3. Model.generateWithTools with a pre-aborted signal
  // -----------------------------------------------------------------------
  describe("Model.generateWithTools with aborted signal", () => {
    it("should reject when signal is already aborted", async () => {
      const provider = createMockProvider({
        async generateWithTools(_msgs, _tools, options) {
          if (options.signal?.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();
      controller.abort();

      await expect(
        model.generateWithTools(SIMPLE_MESSAGES, [SIMPLE_TOOL], {}, { signal: controller.signal }),
      ).rejects.toThrow("aborted");
    });
  });

  // -----------------------------------------------------------------------
  // 4. Signal is threaded through to the provider
  // -----------------------------------------------------------------------
  describe("signal threading to provider", () => {
    it("should pass signal to provider.generate via ProviderRequestOptions", async () => {
      let capturedSignal: AbortSignal | undefined;

      const provider = createMockProvider({
        async generate(_msgs, options) {
          capturedSignal = options.signal;
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();

      await model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBe(controller.signal);
    });

    it("should pass signal to provider.stream via ProviderRequestOptions", async () => {
      let capturedSignal: AbortSignal | undefined;

      const provider = createMockProvider({
        async stream(_msgs, options) {
          capturedSignal = options.signal;
          return streamFromArray([{ type: "done" as const }]);
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();

      await model.stream(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBe(controller.signal);
    });

    it("should pass signal to provider.generateWithTools via ProviderRequestOptions", async () => {
      let capturedSignal: AbortSignal | undefined;

      const provider = createMockProvider({
        async generateWithTools(_msgs, _tools, options) {
          capturedSignal = options.signal;
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();

      await model.generateWithTools(
        SIMPLE_MESSAGES,
        [SIMPLE_TOOL],
        {},
        { signal: controller.signal },
      );

      expect(capturedSignal).toBeDefined();
      expect(capturedSignal).toBe(controller.signal);
    });

    it("should pass undefined signal when no options provided", async () => {
      let capturedSignal: AbortSignal | undefined = "sentinel" as unknown as AbortSignal;

      const provider = createMockProvider({
        async generate(_msgs, options) {
          capturedSignal = options.signal;
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      await model.generate(SIMPLE_MESSAGES);

      expect(capturedSignal).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 5. AbortController.abort() during in-flight request
  // -----------------------------------------------------------------------
  describe("abort during in-flight request", () => {
    it("should reject generate when aborted mid-flight", async () => {
      const controller = new AbortController();

      const provider = createMockProvider({
        async generate(_msgs, options) {
          // Simulate a slow request that respects the signal
          return new Promise<ModelResponse>((resolve, reject) => {
            const onAbort = () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            };

            if (options.signal?.aborted) {
              onAbort();
              return;
            }

            options.signal?.addEventListener("abort", onAbort, { once: true });

            // Resolve after a delay if not aborted
            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve({ ...MOCK_RESPONSE });
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");

      // Kick off the request, then abort shortly after
      const promise = model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      // Abort after a small tick
      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow("aborted");
    });

    it("should reject stream when aborted mid-flight", async () => {
      const controller = new AbortController();

      const provider = createMockProvider({
        async stream(_msgs, options) {
          return new Promise((resolve, reject) => {
            const onAbort = () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            };

            if (options.signal?.aborted) {
              onAbort();
              return;
            }

            options.signal?.addEventListener("abort", onAbort, { once: true });

            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve(streamFromArray([{ type: "done" as const }]));
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");

      const promise = model.stream(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow("aborted");
    });

    it("should reject generateWithTools when aborted mid-flight", async () => {
      const controller = new AbortController();

      const provider = createMockProvider({
        async generateWithTools(_msgs, _tools, options) {
          return new Promise<ModelResponse>((resolve, reject) => {
            const onAbort = () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            };

            if (options.signal?.aborted) {
              onAbort();
              return;
            }

            options.signal?.addEventListener("abort", onAbort, { once: true });

            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve({ ...MOCK_RESPONSE });
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");

      const promise = model.generateWithTools(
        SIMPLE_MESSAGES,
        [SIMPLE_TOOL],
        {},
        { signal: controller.signal },
      );

      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow("aborted");
    });

    it("should have signal.aborted === true after abort()", async () => {
      const controller = new AbortController();
      let signalAbortedAfterAbort = false;

      const provider = createMockProvider({
        async generate(_msgs, options) {
          return new Promise<ModelResponse>((resolve, reject) => {
            const onAbort = () => {
              signalAbortedAfterAbort = options.signal?.aborted ?? false;
              reject(new DOMException("The operation was aborted", "AbortError"));
            };

            options.signal?.addEventListener("abort", onAbort, { once: true });

            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve({ ...MOCK_RESPONSE });
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const promise = model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow();
      expect(signalAbortedAfterAbort).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Additional edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("should succeed if signal is provided but never aborted", async () => {
      const provider = createMockProvider();
      registerProvider(provider);

      const model = createModel("test:my-model");
      const controller = new AbortController();

      const response = await model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      expect(response.text).toBe("test");
      expect(response.finishReason).toBe("stop");
    });

    it("should pass abort reason through when using abort(reason)", async () => {
      const controller = new AbortController();
      const customReason = new Error("user cancelled");

      const provider = createMockProvider({
        async generate(_msgs, options) {
          return new Promise<ModelResponse>((resolve, reject) => {
            const onAbort = () => {
              reject(options.signal?.reason ?? new DOMException("The operation was aborted", "AbortError"));
            };

            if (options.signal?.aborted) {
              onAbort();
              return;
            }

            options.signal?.addEventListener("abort", onAbort, { once: true });

            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve({ ...MOCK_RESPONSE });
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      const promise = model.generate(SIMPLE_MESSAGES, {}, { signal: controller.signal });

      setTimeout(() => controller.abort(customReason), 10);

      await expect(promise).rejects.toThrow("user cancelled");
    });

    it("should work with AbortSignal.timeout()", async () => {
      const provider = createMockProvider({
        async generate(_msgs, options) {
          return new Promise<ModelResponse>((resolve, reject) => {
            const onAbort = () => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            };

            if (options.signal?.aborted) {
              onAbort();
              return;
            }

            options.signal?.addEventListener("abort", onAbort, { once: true });

            setTimeout(() => {
              options.signal?.removeEventListener("abort", onAbort);
              resolve({ ...MOCK_RESPONSE });
            }, 5000);
          });
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model");
      // Use a very short timeout so the provider's 5s delay triggers the abort
      const signal = AbortSignal.timeout(10);

      await expect(
        model.generate(SIMPLE_MESSAGES, {}, { signal }),
      ).rejects.toThrow();
    });

    it("should thread signal alongside model config overrides", async () => {
      let capturedSignal: AbortSignal | undefined;
      let capturedTemp: number | undefined;

      const provider = createMockProvider({
        async generate(_msgs, options) {
          capturedSignal = options.signal;
          capturedTemp = options.temperature;
          return { ...MOCK_RESPONSE };
        },
      });
      registerProvider(provider);

      const model = createModel("test:my-model", { temperature: 0.5 });
      const controller = new AbortController();

      await model.generate(
        SIMPLE_MESSAGES,
        { temperature: 0.9 },
        { signal: controller.signal },
      );

      expect(capturedSignal).toBe(controller.signal);
      expect(capturedTemp).toBe(0.9);
    });
  });
});
