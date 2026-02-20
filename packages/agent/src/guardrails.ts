/**
 * Guardrails for @openlinkos/agent.
 *
 * Provides input validation, output validation, and content filtering
 * hooks that can be attached to an agent.
 */

// ---------------------------------------------------------------------------
// Guardrail types
// ---------------------------------------------------------------------------

/** Result of a guardrail check. */
export interface GuardrailResult {
  /** Whether the check passed. */
  passed: boolean;
  /** Human-readable reason if the check failed. */
  reason?: string;
}

/** An input guardrail that validates user input before processing. */
export interface InputGuardrail {
  /** A name for this guardrail (for logging/debugging). */
  name: string;
  /** Validate the user input. Return passed:false to block processing. */
  validate(input: string): GuardrailResult | Promise<GuardrailResult>;
}

/** An output guardrail that validates the agent's response before returning. */
export interface OutputGuardrail {
  /** A name for this guardrail (for logging/debugging). */
  name: string;
  /** Validate the agent output. Return passed:false to reject and optionally retry. */
  validate(output: string): GuardrailResult | Promise<GuardrailResult>;
}

/** Content filter that can modify or reject content. */
export interface ContentFilter {
  /** A name for this filter. */
  name: string;
  /** Filter the content. Return null/undefined to block, or return modified content. */
  filter(content: string): string | null | Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Guardrail runner
// ---------------------------------------------------------------------------

/**
 * Run a set of input guardrails against an input string.
 * Returns the first failing result, or a passed result if all pass.
 */
export async function runInputGuardrails(
  guardrails: InputGuardrail[],
  input: string,
): Promise<GuardrailResult> {
  for (const guardrail of guardrails) {
    const result = await guardrail.validate(input);
    if (!result.passed) {
      return {
        passed: false,
        reason: `Input guardrail "${guardrail.name}" failed: ${result.reason ?? "unknown reason"}`,
      };
    }
  }
  return { passed: true };
}

/**
 * Run a set of output guardrails against an output string.
 * Returns the first failing result, or a passed result if all pass.
 */
export async function runOutputGuardrails(
  guardrails: OutputGuardrail[],
  output: string,
): Promise<GuardrailResult> {
  for (const guardrail of guardrails) {
    const result = await guardrail.validate(output);
    if (!result.passed) {
      return {
        passed: false,
        reason: `Output guardrail "${guardrail.name}" failed: ${result.reason ?? "unknown reason"}`,
      };
    }
  }
  return { passed: true };
}

/**
 * Apply a chain of content filters to a string.
 * Returns null if any filter blocks the content.
 */
export async function applyContentFilters(
  filters: ContentFilter[],
  content: string,
): Promise<string | null> {
  let current: string | null = content;
  for (const filter of filters) {
    if (current === null) return null;
    current = await filter.filter(current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Built-in guardrails
// ---------------------------------------------------------------------------

/**
 * Create a max-length input guardrail.
 */
export function maxLengthGuardrail(maxLength: number): InputGuardrail {
  return {
    name: "max-length",
    validate(input: string): GuardrailResult {
      if (input.length > maxLength) {
        return {
          passed: false,
          reason: `Input exceeds maximum length of ${maxLength} characters (got ${input.length})`,
        };
      }
      return { passed: true };
    },
  };
}

/**
 * Create a regex-based content filter that blocks matching content.
 */
export function regexBlockFilter(
  name: string,
  pattern: RegExp,
  replacement?: string,
): ContentFilter {
  return {
    name,
    filter(content: string): string | null {
      if (replacement !== undefined) {
        return content.replace(pattern, replacement);
      }
      if (pattern.test(content)) {
        return null;
      }
      return content;
    },
  };
}
