import { describe, it, expect } from "vitest";
import {
  BaseError,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  InvalidRequestError,
  ToolExecutionError,
  GuardrailError,
  AbortError,
  mapHttpError,
} from "../src/errors.js";

// ---------------------------------------------------------------------------
// BaseError
// ---------------------------------------------------------------------------

describe("BaseError", () => {
  it("stores code and message", () => {
    const err = new BaseError("PROVIDER_ERROR", "boom");
    expect(err.code).toBe("PROVIDER_ERROR");
    expect(err.message).toBe("boom");
  });

  it("sets name to the constructor name", () => {
    const err = new BaseError("PROVIDER_ERROR", "boom");
    expect(err.name).toBe("BaseError");
  });

  it("extends Error", () => {
    const err = new BaseError("PROVIDER_ERROR", "boom");
    expect(err).toBeInstanceOf(Error);
  });

  it("preserves cause via ErrorOptions", () => {
    const cause = new Error("root cause");
    const err = new BaseError("PROVIDER_ERROR", "boom", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// ProviderError
// ---------------------------------------------------------------------------

describe("ProviderError", () => {
  it("has code PROVIDER_ERROR", () => {
    const err = new ProviderError("api failed");
    expect(err.code).toBe("PROVIDER_ERROR");
  });

  it("extends BaseError and Error", () => {
    const err = new ProviderError("api failed");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to ProviderError", () => {
    const err = new ProviderError("api failed");
    expect(err.name).toBe("ProviderError");
  });

  it("carries statusCode and provider metadata", () => {
    const err = new ProviderError("api failed", {
      statusCode: 502,
      provider: "openai",
    });
    expect(err.statusCode).toBe(502);
    expect(err.provider).toBe("openai");
  });

  it("leaves metadata undefined when not provided", () => {
    const err = new ProviderError("api failed");
    expect(err.statusCode).toBeUndefined();
    expect(err.provider).toBeUndefined();
  });

  it("preserves cause", () => {
    const cause = new Error("network");
    const err = new ProviderError("api failed", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// RateLimitError
// ---------------------------------------------------------------------------

describe("RateLimitError", () => {
  it("has code RATE_LIMIT", () => {
    const err = new RateLimitError("slow down");
    expect(err.code).toBe("RATE_LIMIT");
  });

  it("extends BaseError and Error", () => {
    const err = new RateLimitError("slow down");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to RateLimitError", () => {
    const err = new RateLimitError("slow down");
    expect(err.name).toBe("RateLimitError");
  });

  it("carries retryAfter and provider metadata", () => {
    const err = new RateLimitError("slow down", {
      retryAfter: 30,
      provider: "anthropic",
    });
    expect(err.retryAfter).toBe(30);
    expect(err.provider).toBe("anthropic");
  });

  it("preserves cause", () => {
    const cause = new Error("429");
    const err = new RateLimitError("slow down", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// AuthenticationError
// ---------------------------------------------------------------------------

describe("AuthenticationError", () => {
  it("has code AUTH_ERROR", () => {
    const err = new AuthenticationError("bad key");
    expect(err.code).toBe("AUTH_ERROR");
  });

  it("extends BaseError and Error", () => {
    const err = new AuthenticationError("bad key");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to AuthenticationError", () => {
    const err = new AuthenticationError("bad key");
    expect(err.name).toBe("AuthenticationError");
  });

  it("carries provider metadata", () => {
    const err = new AuthenticationError("bad key", { provider: "openai" });
    expect(err.provider).toBe("openai");
  });

  it("preserves cause", () => {
    const cause = new Error("expired token");
    const err = new AuthenticationError("bad key", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// TimeoutError
// ---------------------------------------------------------------------------

describe("TimeoutError", () => {
  it("has code TIMEOUT", () => {
    const err = new TimeoutError("timed out");
    expect(err.code).toBe("TIMEOUT");
  });

  it("extends BaseError and Error", () => {
    const err = new TimeoutError("timed out");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to TimeoutError", () => {
    const err = new TimeoutError("timed out");
    expect(err.name).toBe("TimeoutError");
  });

  it("preserves cause", () => {
    const cause = new Error("deadline exceeded");
    const err = new TimeoutError("timed out", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// InvalidRequestError
// ---------------------------------------------------------------------------

describe("InvalidRequestError", () => {
  it("has code INVALID_REQUEST", () => {
    const err = new InvalidRequestError("bad params");
    expect(err.code).toBe("INVALID_REQUEST");
  });

  it("extends BaseError and Error", () => {
    const err = new InvalidRequestError("bad params");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to InvalidRequestError", () => {
    const err = new InvalidRequestError("bad params");
    expect(err.name).toBe("InvalidRequestError");
  });

  it("carries provider metadata", () => {
    const err = new InvalidRequestError("bad params", { provider: "anthropic" });
    expect(err.provider).toBe("anthropic");
  });

  it("preserves cause", () => {
    const cause = new Error("validation");
    const err = new InvalidRequestError("bad params", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// ToolExecutionError
// ---------------------------------------------------------------------------

describe("ToolExecutionError", () => {
  it("has code TOOL_EXECUTION_ERROR", () => {
    const err = new ToolExecutionError("tool failed");
    expect(err.code).toBe("TOOL_EXECUTION_ERROR");
  });

  it("extends BaseError and Error", () => {
    const err = new ToolExecutionError("tool failed");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to ToolExecutionError", () => {
    const err = new ToolExecutionError("tool failed");
    expect(err.name).toBe("ToolExecutionError");
  });

  it("carries toolName metadata", () => {
    const err = new ToolExecutionError("tool failed", { toolName: "calculator" });
    expect(err.toolName).toBe("calculator");
  });

  it("preserves cause", () => {
    const cause = new Error("division by zero");
    const err = new ToolExecutionError("tool failed", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// GuardrailError
// ---------------------------------------------------------------------------

describe("GuardrailError", () => {
  it("has code GUARDRAIL_ERROR", () => {
    const err = new GuardrailError("blocked");
    expect(err.code).toBe("GUARDRAIL_ERROR");
  });

  it("extends BaseError and Error", () => {
    const err = new GuardrailError("blocked");
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to GuardrailError", () => {
    const err = new GuardrailError("blocked");
    expect(err.name).toBe("GuardrailError");
  });

  it("carries guardrailName metadata", () => {
    const err = new GuardrailError("blocked", { guardrailName: "content-filter" });
    expect(err.guardrailName).toBe("content-filter");
  });

  it("preserves cause", () => {
    const cause = new Error("policy violation");
    const err = new GuardrailError("blocked", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// AbortError
// ---------------------------------------------------------------------------

describe("AbortError", () => {
  it("has code ABORT_ERROR", () => {
    const err = new AbortError();
    expect(err.code).toBe("ABORT_ERROR");
  });

  it("uses default message when none provided", () => {
    const err = new AbortError();
    expect(err.message).toBe("The operation was aborted");
  });

  it("accepts a custom message", () => {
    const err = new AbortError("cancelled by user");
    expect(err.message).toBe("cancelled by user");
  });

  it("extends BaseError and Error", () => {
    const err = new AbortError();
    expect(err).toBeInstanceOf(BaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets name to AbortError", () => {
    const err = new AbortError();
    expect(err.name).toBe("AbortError");
  });

  it("preserves cause", () => {
    const cause = new Error("signal aborted");
    const err = new AbortError("cancelled", { cause });
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// instanceof checks across the hierarchy
// ---------------------------------------------------------------------------

describe("instanceof checks", () => {
  const errors = [
    new ProviderError("a"),
    new RateLimitError("b"),
    new AuthenticationError("c"),
    new TimeoutError("d"),
    new InvalidRequestError("e"),
    new ToolExecutionError("f"),
    new GuardrailError("g"),
    new AbortError("h"),
  ];

  it("all error subclasses are instanceof BaseError", () => {
    for (const err of errors) {
      expect(err).toBeInstanceOf(BaseError);
    }
  });

  it("all error subclasses are instanceof Error", () => {
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("ProviderError is not instanceof RateLimitError", () => {
    const err = new ProviderError("a");
    expect(err).not.toBeInstanceOf(RateLimitError);
  });

  it("RateLimitError is not instanceof AuthenticationError", () => {
    const err = new RateLimitError("a");
    expect(err).not.toBeInstanceOf(AuthenticationError);
  });
});

// ---------------------------------------------------------------------------
// mapHttpError
// ---------------------------------------------------------------------------

describe("mapHttpError", () => {
  it("maps 401 to AuthenticationError", () => {
    const err = mapHttpError(401, "unauthorized", "openai");
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.message).toContain("openai");
    expect(err.message).toContain("401");
    expect((err as AuthenticationError).provider).toBe("openai");
  });

  it("maps 403 to AuthenticationError", () => {
    const err = mapHttpError(403, "forbidden", "anthropic");
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.message).toContain("anthropic");
    expect(err.message).toContain("403");
    expect((err as AuthenticationError).provider).toBe("anthropic");
  });

  it("maps 429 to RateLimitError", () => {
    const err = mapHttpError(429, "too many requests", "openai");
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.message).toContain("429");
    expect((err as RateLimitError).provider).toBe("openai");
  });

  it("maps 429 with retry-after header", () => {
    const headers = new Headers({ "retry-after": "60" });
    const err = mapHttpError(429, "too many requests", "openai", headers);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(60);
  });

  it("ignores non-numeric retry-after header", () => {
    const headers = new Headers({ "retry-after": "not-a-number" });
    const err = mapHttpError(429, "too many requests", "openai", headers);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBeUndefined();
  });

  it("maps 429 without headers leaves retryAfter undefined", () => {
    const err = mapHttpError(429, "too many requests", "openai");
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBeUndefined();
  });

  it("maps 400 to InvalidRequestError", () => {
    const err = mapHttpError(400, "bad request", "anthropic");
    expect(err).toBeInstanceOf(InvalidRequestError);
    expect(err.code).toBe("INVALID_REQUEST");
    expect(err.message).toContain("400");
    expect((err as InvalidRequestError).provider).toBe("anthropic");
  });

  it("maps 500 to ProviderError", () => {
    const err = mapHttpError(500, "internal server error", "openai");
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("PROVIDER_ERROR");
    expect(err.message).toContain("500");
    expect((err as ProviderError).statusCode).toBe(500);
    expect((err as ProviderError).provider).toBe("openai");
  });

  it("maps other status codes to ProviderError (default)", () => {
    const err = mapHttpError(503, "service unavailable", "anthropic");
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe("PROVIDER_ERROR");
    expect((err as ProviderError).statusCode).toBe(503);
    expect((err as ProviderError).provider).toBe("anthropic");
  });
});
