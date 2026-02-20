/**
 * Typed error hierarchy for @openlinkos/ai.
 *
 * Every error carries a machine-readable `code` field so consumers can
 * branch on error type without resorting to string matching.
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "PROVIDER_ERROR"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "TOOL_EXECUTION_ERROR"
  | "GUARDRAIL_ERROR"
  | "ABORT_ERROR";

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

/**
 * Base error class for all @openlinkos/ai errors.
 */
export class BaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Provider error
// ---------------------------------------------------------------------------

/**
 * An error returned by a model provider (generic API error).
 */
export class ProviderError extends BaseError {
  readonly statusCode?: number;
  readonly provider?: string;

  constructor(
    message: string,
    options?: { statusCode?: number; provider?: string; cause?: unknown },
  ) {
    super("PROVIDER_ERROR", message, options?.cause ? { cause: options.cause } : undefined);
    this.statusCode = options?.statusCode;
    this.provider = options?.provider;
  }
}

// ---------------------------------------------------------------------------
// Rate-limit error
// ---------------------------------------------------------------------------

/**
 * The provider returned a 429 (rate limit) response.
 */
export class RateLimitError extends BaseError {
  readonly retryAfter?: number;
  readonly provider?: string;

  constructor(
    message: string,
    options?: { retryAfter?: number; provider?: string; cause?: unknown },
  ) {
    super("RATE_LIMIT", message, options?.cause ? { cause: options.cause } : undefined);
    this.retryAfter = options?.retryAfter;
    this.provider = options?.provider;
  }
}

// ---------------------------------------------------------------------------
// Authentication error
// ---------------------------------------------------------------------------

/**
 * Authentication / authorization failure (401 or 403).
 */
export class AuthenticationError extends BaseError {
  readonly provider?: string;

  constructor(
    message: string,
    options?: { provider?: string; cause?: unknown },
  ) {
    super("AUTH_ERROR", message, options?.cause ? { cause: options.cause } : undefined);
    this.provider = options?.provider;
  }
}

// ---------------------------------------------------------------------------
// Timeout error
// ---------------------------------------------------------------------------

/**
 * A request or stream timed out.
 */
export class TimeoutError extends BaseError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("TIMEOUT", message, options?.cause ? { cause: options.cause } : undefined);
  }
}

// ---------------------------------------------------------------------------
// Invalid request error
// ---------------------------------------------------------------------------

/**
 * The request was malformed or contained invalid parameters (400).
 */
export class InvalidRequestError extends BaseError {
  readonly provider?: string;

  constructor(
    message: string,
    options?: { provider?: string; cause?: unknown },
  ) {
    super("INVALID_REQUEST", message, options?.cause ? { cause: options.cause } : undefined);
    this.provider = options?.provider;
  }
}

// ---------------------------------------------------------------------------
// Tool execution error
// ---------------------------------------------------------------------------

/**
 * A tool execution failed.
 */
export class ToolExecutionError extends BaseError {
  readonly toolName?: string;

  constructor(
    message: string,
    options?: { toolName?: string; cause?: unknown },
  ) {
    super("TOOL_EXECUTION_ERROR", message, options?.cause ? { cause: options.cause } : undefined);
    this.toolName = options?.toolName;
  }
}

// ---------------------------------------------------------------------------
// Guardrail error
// ---------------------------------------------------------------------------

/**
 * A guardrail check blocked the request or response.
 */
export class GuardrailError extends BaseError {
  readonly guardrailName?: string;

  constructor(
    message: string,
    options?: { guardrailName?: string; cause?: unknown },
  ) {
    super("GUARDRAIL_ERROR", message, options?.cause ? { cause: options.cause } : undefined);
    this.guardrailName = options?.guardrailName;
  }
}

// ---------------------------------------------------------------------------
// Abort error
// ---------------------------------------------------------------------------

/**
 * The operation was cancelled via an AbortSignal.
 */
export class AbortError extends BaseError {
  constructor(message?: string, options?: { cause?: unknown }) {
    super("ABORT_ERROR", message ?? "The operation was aborted", options?.cause ? { cause: options.cause } : undefined);
  }
}

// ---------------------------------------------------------------------------
// HTTP status → typed error mapping
// ---------------------------------------------------------------------------

/**
 * Map an HTTP status code and response body to the appropriate typed error.
 */
export function mapHttpError(
  status: number,
  body: string,
  provider: string,
  headers?: Headers,
): BaseError {
  switch (status) {
    case 401:
    case 403:
      return new AuthenticationError(
        `${provider} authentication failed (${status}): ${body}`,
        { provider },
      );

    case 429: {
      let retryAfter: number | undefined;
      if (headers) {
        const ra = headers.get("retry-after");
        if (ra) {
          const parsed = Number(ra);
          retryAfter = Number.isFinite(parsed) ? parsed : undefined;
        }
      }
      return new RateLimitError(
        `${provider} rate limit exceeded (429): ${body}`,
        { retryAfter, provider },
      );
    }

    case 400:
      return new InvalidRequestError(
        `${provider} invalid request (400): ${body}`,
        { provider },
      );

    default:
      return new ProviderError(
        `${provider} API error (${status}): ${body}`,
        { statusCode: status, provider },
      );
  }
}
