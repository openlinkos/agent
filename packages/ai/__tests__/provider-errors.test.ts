/**
 * Tests for provider error mapping across OpenAI, Anthropic, and Google providers.
 *
 * Validates that:
 * - mapHttpError maps HTTP status codes to the correct typed errors
 * - Each provider throws AuthenticationError when no API key is configured
 * - defaultIsRetryable correctly classifies each typed error
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  mapHttpError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ProviderError,
  TimeoutError,
  AbortError,
} from "../src/errors.js";
import { OpenAIProvider } from "../src/providers/openai.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GoogleProvider } from "../src/providers/google.js";
import { defaultIsRetryable } from "../src/retry.js";

// ---------------------------------------------------------------------------
// mapHttpError — provider-specific mapping
// ---------------------------------------------------------------------------

describe("mapHttpError", () => {
  it("maps 401 to AuthenticationError for OpenAI", () => {
    const err = mapHttpError(401, "Unauthorized", "OpenAI");
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toContain("OpenAI");
    expect(err.message).toContain("401");
    expect((err as AuthenticationError).provider).toBe("OpenAI");
  });

  it("maps 403 to AuthenticationError for Anthropic", () => {
    const err = mapHttpError(403, "Forbidden", "Anthropic");
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toContain("Anthropic");
    expect(err.message).toContain("403");
    expect((err as AuthenticationError).provider).toBe("Anthropic");
  });

  it("maps 429 to RateLimitError for Google", () => {
    const err = mapHttpError(429, "Too Many Requests", "Google");
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.message).toContain("Google");
    expect(err.message).toContain("429");
    expect((err as RateLimitError).provider).toBe("Google");
  });

  it("maps 429 with retry-after header", () => {
    const headers = new Headers({ "retry-after": "30" });
    const err = mapHttpError(429, "Rate limited", "OpenAI", headers);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(30);
  });

  it("maps 429 with non-numeric retry-after header gracefully", () => {
    const headers = new Headers({ "retry-after": "not-a-number" });
    const err = mapHttpError(429, "Rate limited", "OpenAI", headers);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBeUndefined();
  });

  it("maps 400 to InvalidRequestError for OpenAI", () => {
    const err = mapHttpError(400, "Bad Request", "OpenAI");
    expect(err).toBeInstanceOf(InvalidRequestError);
    expect(err.message).toContain("OpenAI");
    expect(err.message).toContain("400");
    expect((err as InvalidRequestError).provider).toBe("OpenAI");
  });

  it("maps 500 to ProviderError for Anthropic", () => {
    const err = mapHttpError(500, "Internal Server Error", "Anthropic");
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).statusCode).toBe(500);
    expect((err as ProviderError).provider).toBe("Anthropic");
  });

  it("maps 502 to ProviderError for Google", () => {
    const err = mapHttpError(502, "Bad Gateway", "Google");
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).statusCode).toBe(502);
    expect((err as ProviderError).provider).toBe("Google");
  });

  it("maps 503 to ProviderError", () => {
    const err = mapHttpError(503, "Service Unavailable", "OpenAI");
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).statusCode).toBe(503);
  });

  it("maps unknown status codes to ProviderError", () => {
    const err = mapHttpError(418, "I'm a teapot", "OpenAI");
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).statusCode).toBe(418);
    expect(err.message).toContain("418");
  });

  it("includes response body in error message", () => {
    const body = '{"error":{"message":"model not found"}}';
    const err = mapHttpError(404, body, "Google");
    expect(err.message).toContain("model not found");
  });
});

// ---------------------------------------------------------------------------
// Provider auth errors — each provider throws AuthenticationError when
// no API key is available
// ---------------------------------------------------------------------------

describe("OpenAI auth", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.OPENAI_API_KEY = origKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("throws AuthenticationError without API key", async () => {
    origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "gpt-4o" },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("includes provider name in auth error", async () => {
    origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "gpt-4o" },
      ),
    ).rejects.toThrow(/openai/i);
  });
});

describe("Anthropic auth", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = origKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("throws AuthenticationError without API key", async () => {
    origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const provider = new AnthropicProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "claude-sonnet-4-20250514" },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("includes provider name in auth error", async () => {
    origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const provider = new AnthropicProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "claude-sonnet-4-20250514" },
      ),
    ).rejects.toThrow(/anthropic/i);
  });
});

describe("Google auth", () => {
  let origKey: string | undefined;

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.GOOGLE_API_KEY = origKey;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it("throws AuthenticationError without API key", async () => {
    origKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const provider = new GoogleProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "gemini-pro" },
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("includes provider name in auth error", async () => {
    origKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const provider = new GoogleProvider();

    await expect(
      provider.generate(
        [{ role: "user", content: "test" }],
        { modelName: "gemini-pro" },
      ),
    ).rejects.toThrow(/google/i);
  });
});

// ---------------------------------------------------------------------------
// defaultIsRetryable with typed errors
// ---------------------------------------------------------------------------

describe("defaultIsRetryable with typed errors", () => {
  it("retries RateLimitError", () => {
    expect(defaultIsRetryable(new RateLimitError("rate limited"))).toBe(true);
  });

  it("retries RateLimitError with retryAfter", () => {
    expect(
      defaultIsRetryable(new RateLimitError("rate limited", { retryAfter: 5 })),
    ).toBe(true);
  });

  it("retries TimeoutError", () => {
    expect(defaultIsRetryable(new TimeoutError("timed out"))).toBe(true);
  });

  it("retries 500 ProviderError", () => {
    expect(
      defaultIsRetryable(new ProviderError("server error", { statusCode: 500 })),
    ).toBe(true);
  });

  it("retries 502 ProviderError", () => {
    expect(
      defaultIsRetryable(new ProviderError("bad gateway", { statusCode: 502 })),
    ).toBe(true);
  });

  it("retries 503 ProviderError", () => {
    expect(
      defaultIsRetryable(
        new ProviderError("service unavailable", { statusCode: 503 }),
      ),
    ).toBe(true);
  });

  it("retries 504 ProviderError", () => {
    expect(
      defaultIsRetryable(
        new ProviderError("gateway timeout", { statusCode: 504 }),
      ),
    ).toBe(true);
  });

  it("does not retry AuthenticationError", () => {
    expect(defaultIsRetryable(new AuthenticationError("bad key"))).toBe(false);
  });

  it("does not retry InvalidRequestError", () => {
    expect(
      defaultIsRetryable(new InvalidRequestError("malformed request")),
    ).toBe(false);
  });

  it("does not retry AbortError", () => {
    expect(defaultIsRetryable(new AbortError())).toBe(false);
  });

  it("does not retry 400 ProviderError", () => {
    expect(
      defaultIsRetryable(
        new ProviderError("bad request", { statusCode: 400 }),
      ),
    ).toBe(false);
  });

  it("does not retry 404 ProviderError", () => {
    expect(
      defaultIsRetryable(new ProviderError("not found", { statusCode: 404 })),
    ).toBe(false);
  });

  it("does not retry ProviderError without statusCode", () => {
    expect(defaultIsRetryable(new ProviderError("unknown error"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error code field validation
// ---------------------------------------------------------------------------

describe("error code fields", () => {
  it("ProviderError has code PROVIDER_ERROR", () => {
    const err = new ProviderError("test");
    expect(err.code).toBe("PROVIDER_ERROR");
  });

  it("RateLimitError has code RATE_LIMIT", () => {
    const err = new RateLimitError("test");
    expect(err.code).toBe("RATE_LIMIT");
  });

  it("AuthenticationError has code AUTH_ERROR", () => {
    const err = new AuthenticationError("test");
    expect(err.code).toBe("AUTH_ERROR");
  });

  it("TimeoutError has code TIMEOUT", () => {
    const err = new TimeoutError("test");
    expect(err.code).toBe("TIMEOUT");
  });

  it("InvalidRequestError has code INVALID_REQUEST", () => {
    const err = new InvalidRequestError("test");
    expect(err.code).toBe("INVALID_REQUEST");
  });

  it("AbortError has code ABORT_ERROR", () => {
    const err = new AbortError();
    expect(err.code).toBe("ABORT_ERROR");
  });

  it("mapHttpError produces errors with correct codes", () => {
    expect(mapHttpError(401, "", "X").code).toBe("AUTH_ERROR");
    expect(mapHttpError(403, "", "X").code).toBe("AUTH_ERROR");
    expect(mapHttpError(429, "", "X").code).toBe("RATE_LIMIT");
    expect(mapHttpError(400, "", "X").code).toBe("INVALID_REQUEST");
    expect(mapHttpError(500, "", "X").code).toBe("PROVIDER_ERROR");
  });
});
