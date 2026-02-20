/**
 * Tests for guardrails.
 */

import { describe, it, expect } from "vitest";
import {
  runInputGuardrails,
  runOutputGuardrails,
  applyContentFilters,
  maxLengthGuardrail,
  regexBlockFilter,
} from "../src/guardrails.js";
import type {
  InputGuardrail,
  OutputGuardrail,
  ContentFilter,
} from "../src/guardrails.js";

// ---------------------------------------------------------------------------
// Input guardrails
// ---------------------------------------------------------------------------

describe("runInputGuardrails", () => {
  it("should pass when all guardrails pass", async () => {
    const guardrails: InputGuardrail[] = [
      { name: "g1", validate: () => ({ passed: true }) },
      { name: "g2", validate: () => ({ passed: true }) },
    ];

    const result = await runInputGuardrails(guardrails, "test input");
    expect(result.passed).toBe(true);
  });

  it("should fail on first failing guardrail", async () => {
    const guardrails: InputGuardrail[] = [
      { name: "g1", validate: () => ({ passed: true }) },
      {
        name: "g2",
        validate: () => ({ passed: false, reason: "too short" }),
      },
      { name: "g3", validate: () => ({ passed: true }) },
    ];

    const result = await runInputGuardrails(guardrails, "hi");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("g2");
    expect(result.reason).toContain("too short");
  });

  it("should pass with empty guardrails", async () => {
    const result = await runInputGuardrails([], "anything");
    expect(result.passed).toBe(true);
  });

  it("should handle async guardrails", async () => {
    const guardrails: InputGuardrail[] = [
      {
        name: "async-guard",
        validate: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { passed: true };
        },
      },
    ];

    const result = await runInputGuardrails(guardrails, "test");
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Output guardrails
// ---------------------------------------------------------------------------

describe("runOutputGuardrails", () => {
  it("should pass when all guardrails pass", async () => {
    const guardrails: OutputGuardrail[] = [
      { name: "o1", validate: () => ({ passed: true }) },
    ];

    const result = await runOutputGuardrails(guardrails, "output text");
    expect(result.passed).toBe(true);
  });

  it("should fail on failing guardrail", async () => {
    const guardrails: OutputGuardrail[] = [
      {
        name: "no-pii",
        validate: (output) => {
          if (output.includes("SSN")) {
            return { passed: false, reason: "Contains PII" };
          }
          return { passed: true };
        },
      },
    ];

    const result = await runOutputGuardrails(guardrails, "Your SSN is 123-45-6789");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("PII");
  });
});

// ---------------------------------------------------------------------------
// Content filters
// ---------------------------------------------------------------------------

describe("applyContentFilters", () => {
  it("should pass content through all filters", async () => {
    const filters: ContentFilter[] = [
      { name: "trim", filter: (c) => c.trim() },
      { name: "lower", filter: (c) => c.toLowerCase() },
    ];

    const result = await applyContentFilters(filters, "  HELLO  ");
    expect(result).toBe("hello");
  });

  it("should return null if a filter blocks content", async () => {
    const filters: ContentFilter[] = [
      { name: "block", filter: () => null },
      { name: "lower", filter: (c) => c.toLowerCase() },
    ];

    const result = await applyContentFilters(filters, "test");
    expect(result).toBeNull();
  });

  it("should handle async filters", async () => {
    const filters: ContentFilter[] = [
      {
        name: "async-filter",
        filter: async (c) => {
          await new Promise((r) => setTimeout(r, 10));
          return c + " processed";
        },
      },
    ];

    const result = await applyContentFilters(filters, "input");
    expect(result).toBe("input processed");
  });

  it("should return original content with no filters", async () => {
    const result = await applyContentFilters([], "original");
    expect(result).toBe("original");
  });
});

// ---------------------------------------------------------------------------
// Built-in guardrails
// ---------------------------------------------------------------------------

describe("maxLengthGuardrail", () => {
  it("should pass for short input", () => {
    const guard = maxLengthGuardrail(100);
    expect(guard.validate("short")).toEqual({ passed: true });
  });

  it("should fail for long input", () => {
    const guard = maxLengthGuardrail(5);
    const result = guard.validate("too long input");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("maximum length of 5");
  });

  it("should pass at exact length", () => {
    const guard = maxLengthGuardrail(5);
    expect(guard.validate("12345")).toEqual({ passed: true });
  });

  it("should have the correct name", () => {
    const guard = maxLengthGuardrail(10);
    expect(guard.name).toBe("max-length");
  });
});

describe("regexBlockFilter", () => {
  it("should block content matching pattern", () => {
    const filter = regexBlockFilter("block-test", /badword/i);
    expect(filter.filter("contains badword here")).toBeNull();
  });

  it("should pass content not matching pattern", () => {
    const filter = regexBlockFilter("block-test", /badword/i);
    expect(filter.filter("clean content")).toBe("clean content");
  });

  it("should replace content when replacement is provided", () => {
    const filter = regexBlockFilter("replace-test", /bad/g, "[redacted]");
    expect(filter.filter("bad word and bad phrase")).toBe(
      "[redacted] word and [redacted] phrase",
    );
  });

  it("should have the correct name", () => {
    const filter = regexBlockFilter("my-filter", /test/);
    expect(filter.name).toBe("my-filter");
  });
});
