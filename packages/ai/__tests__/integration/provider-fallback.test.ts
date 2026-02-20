/**
 * Integration tests: provider fallback chain end-to-end.
 *
 * Uses multiple mock HTTP servers to verify that FallbackProvider
 * correctly falls through to the next provider on failure.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  registerProvider,
  clearProviders,
  createFallback,
} from "../../src/index.js";
import type { ModelProvider, ProviderRequestOptions } from "../../src/provider.js";
import type { Message, ModelResponse, ModelCapabilities } from "../../src/types.js";
import type { StreamResult } from "../../src/stream.js";
import { streamFromArray } from "../../src/stream.js";

// ---------------------------------------------------------------------------
// Helper: create an HTTP server that responds (or fails) on demand
// ---------------------------------------------------------------------------

interface MockServerConfig {
  statusCode: number;
  responseBody?: Record<string, unknown>;
}

function startMockServer(config: MockServerConfig): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const s = http.createServer((_req, res) => {
      let body = "";
      _req.on("data", (chunk) => { body += chunk; });
      _req.on("end", () => {
        res.writeHead(config.statusCode, { "Content-Type": "application/json" });
        if (config.responseBody) {
          res.end(JSON.stringify(config.responseBody));
        } else {
          res.end(JSON.stringify({ error: "Server error" }));
        }
      });
    });

    s.listen(0, "127.0.0.1", () => {
      const addr = s.address() as AddressInfo;
      resolve({ server: s, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(s: http.Server): Promise<void> {
  return new Promise((resolve) => s.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// Helper: create a real provider that talks to a given URL
// ---------------------------------------------------------------------------

function createHTTPProvider(
  name: string,
  providerBaseURL: string,
): ModelProvider {
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
    async generate(messages: Message[], _options: ProviderRequestOptions): Promise<ModelResponse> {
      const response = await fetch(`${providerBaseURL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: _options.modelName }),
      });

      if (!response.ok) {
        throw new Error(`Provider ${name} HTTP error: ${response.status}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      return {
        text: data.choices[0].message.content,
        toolCalls: [],
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: "stop",
      };
    },
    async stream(): Promise<StreamResult> {
      return streamFromArray([{ type: "text_delta", text: "fallback" }, { type: "done" }]);
    },
    async generateWithTools(messages, _tools, options): Promise<ModelResponse> {
      return this.generate(messages, options);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Integration: Provider Fallback Chain", () => {
  let failingServer: { server: http.Server; url: string };
  let workingServer: { server: http.Server; url: string };

  beforeAll(async () => {
    failingServer = await startMockServer({ statusCode: 500 });
    workingServer = await startMockServer({
      statusCode: 200,
      responseBody: {
        id: "cmpl-fallback",
        choices: [{
          message: { role: "assistant", content: "Response from fallback provider" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    });
  });

  afterAll(async () => {
    await Promise.all([
      closeServer(failingServer.server),
      closeServer(workingServer.server),
    ]);
  });

  beforeEach(() => {
    clearProviders();
  });

  it("should fall through to the next provider when the first fails", async () => {
    const primary = createHTTPProvider("primary", failingServer.url);
    const fallback = createHTTPProvider("fallback", workingServer.url);

    const chain = createFallback([primary, fallback], { retryOptions: { maxRetries: 0 } });

    const response = await chain.generate(
      [{ role: "user", content: "Hello" }],
      { modelName: "test-model" },
    );

    expect(response.text).toBe("Response from fallback provider");
    expect(response.usage.totalTokens).toBe(15);
  });

  it("should return immediately if the first provider succeeds", async () => {
    const primary = createHTTPProvider("primary", workingServer.url);
    const fallback = createHTTPProvider("fallback", failingServer.url);

    const chain = createFallback([primary, fallback], { retryOptions: { maxRetries: 0 } });

    const response = await chain.generate(
      [{ role: "user", content: "Hello" }],
      { modelName: "test-model" },
    );

    expect(response.text).toBe("Response from fallback provider");
  });

  it("should throw after all providers fail", async () => {
    const p1 = createHTTPProvider("p1", failingServer.url);
    const p2 = createHTTPProvider("p2", failingServer.url);

    const chain = createFallback([p1, p2], { retryOptions: { maxRetries: 0 } });

    await expect(
      chain.generate(
        [{ role: "user", content: "Hello" }],
        { modelName: "test-model" },
      ),
    ).rejects.toThrow("HTTP error: 500");
  });

  it("should report its name as fallback(provider1,provider2)", () => {
    const p1 = createHTTPProvider("alpha", workingServer.url);
    const p2 = createHTTPProvider("beta", failingServer.url);

    const chain = createFallback([p1, p2]);
    expect(chain.name).toBe("fallback(alpha,beta)");
  });
});
