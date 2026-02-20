/**
 * Tests for tool composition utilities.
 */

import { describe, it, expect, vi } from "vitest";
import {
  composeTool,
  conditionalTool,
  toolGroup,
  retryTool,
} from "../src/tool-compose.js";
import type { ToolDefinition } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTool(name: string, fn: (p: Record<string, unknown>) => Promise<unknown>): ToolDefinition {
  return {
    name,
    description: `Tool: ${name}`,
    parameters: {
      type: "object",
      properties: { input: { type: "string" } },
    },
    execute: fn,
  };
}

// ---------------------------------------------------------------------------
// composeTool
// ---------------------------------------------------------------------------

describe("composeTool", () => {
  it("should chain two tools, piping output as input", async () => {
    const upper = mkTool("upper", async (p) => String(p.input).toUpperCase());
    const exclaim = mkTool("exclaim", async (p) => `${p.input}!`);

    const composed = composeTool([upper, exclaim], "shout", "Uppercase then exclaim");
    expect(composed.name).toBe("shout");
    expect(composed.description).toBe("Uppercase then exclaim");

    const result = await composed.execute({ input: "hello" });
    expect(result).toBe("HELLO!");
  });

  it("should pass original params to first tool", async () => {
    const first = mkTool("first", async (p) => `got:${p.input},extra:${p.extra}`);
    const second = mkTool("second", async (p) => `wrapped(${p.input})`);

    const composed = composeTool([first, second], "chain", "Chain test");
    const result = await composed.execute({ input: "a", extra: "b" });
    expect(result).toBe("wrapped(got:a,extra:b)");
  });

  it("should handle a single tool in the chain", async () => {
    const solo = mkTool("solo", async (p) => `solo:${p.input}`);
    const composed = composeTool([solo], "single", "Single tool chain");

    const result = await composed.execute({ input: "test" });
    expect(result).toBe("solo:test");
  });

  it("should serialize non-string results between tools", async () => {
    const objectTool = mkTool("obj", async () => ({ key: "value" }));
    const reader = mkTool("reader", async (p) => `read:${p.input}`);

    const composed = composeTool([objectTool, reader], "pipe", "Pipe object");
    const result = await composed.execute({});
    expect(result).toBe('read:{"key":"value"}');
  });

  it("should chain three tools", async () => {
    const a = mkTool("a", async (p) => `a(${p.input})`);
    const b = mkTool("b", async (p) => `b(${p.input})`);
    const c = mkTool("c", async (p) => `c(${p.input})`);

    const composed = composeTool([a, b, c], "abc", "Three chain");
    const result = await composed.execute({ input: "x" });
    expect(result).toBe("c(b(a(x)))");
  });

  it("should propagate errors from any tool in the chain", async () => {
    const ok = mkTool("ok", async (p) => `ok:${p.input}`);
    const fail = mkTool("fail", async () => { throw new Error("chain fail"); });

    const composed = composeTool([ok, fail], "fail_chain", "Fail chain");
    await expect(composed.execute({ input: "x" })).rejects.toThrow("chain fail");
  });

  it("should throw when given empty tools array", () => {
    expect(() => composeTool([], "empty", "Empty")).toThrow(
      "composeTool requires at least one tool",
    );
  });

  it("should use first tool parameters as the composed parameters", () => {
    const first: ToolDefinition = {
      name: "first",
      description: "First",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      execute: async (p) => p.city,
    };
    const second = mkTool("second", async (p) => p.input);

    const composed = composeTool([first, second], "c", "C");
    expect(composed.parameters.properties?.city).toBeDefined();
    expect(composed.parameters.required).toContain("city");
  });
});

// ---------------------------------------------------------------------------
// conditionalTool
// ---------------------------------------------------------------------------

describe("conditionalTool", () => {
  it("should execute toolA when condition returns true", async () => {
    const toolA = mkTool("a", async () => "result-A");
    const toolB = mkTool("b", async () => "result-B");

    const cond = conditionalTool(() => true, toolA, toolB);
    const result = await cond.execute({});
    expect(result).toBe("result-A");
  });

  it("should execute toolB when condition returns false", async () => {
    const toolA = mkTool("a", async () => "result-A");
    const toolB = mkTool("b", async () => "result-B");

    const cond = conditionalTool(() => false, toolA, toolB);
    const result = await cond.execute({});
    expect(result).toBe("result-B");
  });

  it("should pass params to the condition function", async () => {
    const toolA = mkTool("fast", async () => "fast-result");
    const toolB = mkTool("slow", async () => "slow-result");

    const cond = conditionalTool(
      (params) => params.mode === "fast",
      toolA,
      toolB,
    );

    expect(await cond.execute({ mode: "fast" })).toBe("fast-result");
    expect(await cond.execute({ mode: "slow" })).toBe("slow-result");
  });

  it("should support async condition", async () => {
    const toolA = mkTool("a", async () => "A");
    const toolB = mkTool("b", async () => "B");

    const cond = conditionalTool(async () => true, toolA, toolB);
    expect(await cond.execute({})).toBe("A");
  });

  it("should generate a combined name", () => {
    const toolA = mkTool("alpha", async () => "A");
    const toolB = mkTool("beta", async () => "B");

    const cond = conditionalTool(() => true, toolA, toolB);
    expect(cond.name).toBe("alpha_or_beta");
  });

  it("should generate a combined description", () => {
    const toolA = mkTool("a", async () => "A");
    const toolB = mkTool("b", async () => "B");

    const cond = conditionalTool(() => true, toolA, toolB);
    expect(cond.description).toContain("Tool: a");
    expect(cond.description).toContain("Tool: b");
  });

  it("should merge parameters from both tools", () => {
    const toolA: ToolDefinition = {
      name: "a",
      description: "A",
      parameters: {
        type: "object",
        properties: { x: { type: "string" } },
        required: ["x"],
      },
      execute: async () => "A",
    };
    const toolB: ToolDefinition = {
      name: "b",
      description: "B",
      parameters: {
        type: "object",
        properties: { y: { type: "number" } },
        required: ["y"],
      },
      execute: async () => "B",
    };

    const cond = conditionalTool(() => true, toolA, toolB);
    expect(cond.parameters.properties?.x).toBeDefined();
    expect(cond.parameters.properties?.y).toBeDefined();
    expect(cond.parameters.required).toContain("x");
    expect(cond.parameters.required).toContain("y");
  });

  it("should pass params to the selected tool", async () => {
    const toolA = mkTool("a", async (p) => `A:${p.input}`);
    const toolB = mkTool("b", async (p) => `B:${p.input}`);

    const cond = conditionalTool(() => true, toolA, toolB);
    expect(await cond.execute({ input: "hello" })).toBe("A:hello");
  });

  it("should propagate errors from the selected tool", async () => {
    const toolA = mkTool("a", async () => { throw new Error("A broke"); });
    const toolB = mkTool("b", async () => "B");

    const cond = conditionalTool(() => true, toolA, toolB);
    await expect(cond.execute({})).rejects.toThrow("A broke");
  });
});

// ---------------------------------------------------------------------------
// toolGroup
// ---------------------------------------------------------------------------

describe("toolGroup", () => {
  it("should prefix tool names with group name", () => {
    const t1 = mkTool("search", async () => "result");
    const t2 = mkTool("fetch", async () => "result");

    const grouped = toolGroup([t1, t2], "web", "Web tools");
    expect(grouped[0].name).toBe("web_search");
    expect(grouped[1].name).toBe("web_fetch");
  });

  it("should prefix descriptions with group description", () => {
    const t = mkTool("search", async () => "result");
    const grouped = toolGroup([t], "web", "Web tools");
    expect(grouped[0].description).toBe("[Web tools] Tool: search");
  });

  it("should preserve tool parameters", () => {
    const t: ToolDefinition = {
      name: "query",
      description: "Query DB",
      parameters: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
      execute: async () => "rows",
    };

    const grouped = toolGroup([t], "db", "Database");
    expect(grouped[0].parameters).toBe(t.parameters);
  });

  it("should preserve tool execute function", async () => {
    const t = mkTool("echo", async (p) => `echo:${p.input}`);
    const grouped = toolGroup([t], "util", "Utilities");

    const result = await grouped[0].execute({ input: "test" });
    expect(result).toBe("echo:test");
  });

  it("should return empty array for empty tools", () => {
    const grouped = toolGroup([], "empty", "Empty group");
    expect(grouped).toEqual([]);
  });

  it("should handle single tool", () => {
    const t = mkTool("only", async () => "result");
    const grouped = toolGroup([t], "ns", "Namespace");
    expect(grouped).toHaveLength(1);
    expect(grouped[0].name).toBe("ns_only");
  });
});

// ---------------------------------------------------------------------------
// retryTool
// ---------------------------------------------------------------------------

describe("retryTool", () => {
  it("should return result on first success", async () => {
    const t = mkTool("ok", async () => "success");
    const wrapped = retryTool(t, 3);

    expect(await wrapped.execute({})).toBe("success");
  });

  it("should retry on failure and succeed", async () => {
    let calls = 0;
    const t = mkTool("flaky", async () => {
      calls++;
      if (calls < 3) throw new Error("not yet");
      return "finally";
    });

    const wrapped = retryTool(t, 3);
    const result = await wrapped.execute({});
    expect(result).toBe("finally");
    expect(calls).toBe(3);
  });

  it("should throw after exhausting retries", async () => {
    const t = mkTool("fail", async () => { throw new Error("always fails"); });
    const wrapped = retryTool(t, 2);

    await expect(wrapped.execute({})).rejects.toThrow("always fails");
  });

  it("should attempt exactly maxRetries + 1 times", async () => {
    let attempts = 0;
    const t = mkTool("counter", async () => {
      attempts++;
      throw new Error("fail");
    });

    const wrapped = retryTool(t, 3);
    await expect(wrapped.execute({})).rejects.toThrow("fail");
    expect(attempts).toBe(4); // 1 initial + 3 retries
  });

  it("should preserve tool name and description", () => {
    const t = mkTool("original", async () => "ok");
    const wrapped = retryTool(t, 2);

    expect(wrapped.name).toBe("original");
    expect(wrapped.description).toBe("Tool: original");
  });

  it("should preserve tool parameters", () => {
    const t: ToolDefinition = {
      name: "typed",
      description: "Typed tool",
      parameters: {
        type: "object",
        properties: { x: { type: "number" } },
        required: ["x"],
      },
      execute: async () => "ok",
    };

    const wrapped = retryTool(t, 2);
    expect(wrapped.parameters).toBe(t.parameters);
  });

  it("should pass params to execute on each attempt", async () => {
    const received: Record<string, unknown>[] = [];
    let calls = 0;
    const t = mkTool("tracker", async (p) => {
      received.push({ ...p });
      calls++;
      if (calls < 2) throw new Error("retry");
      return "done";
    });

    const wrapped = retryTool(t, 2);
    await wrapped.execute({ input: "test" });
    expect(received).toHaveLength(2);
    expect(received[0].input).toBe("test");
    expect(received[1].input).toBe("test");
  });

  it("should default to 3 retries", async () => {
    let attempts = 0;
    const t = mkTool("default_retry", async () => {
      attempts++;
      throw new Error("fail");
    });

    const wrapped = retryTool(t);
    await expect(wrapped.execute({})).rejects.toThrow("fail");
    expect(attempts).toBe(4); // 1 initial + 3 default retries
  });

  it("should handle non-Error throws", async () => {
    const t = mkTool("string_throw", async () => {
      throw "string error"; // eslint-disable-line no-throw-literal
    });

    const wrapped = retryTool(t, 1);
    await expect(wrapped.execute({})).rejects.toThrow("string error");
  });

  it("should succeed with zero retries if first attempt works", async () => {
    const t = mkTool("zero", async () => "ok");
    const wrapped = retryTool(t, 0);
    expect(await wrapped.execute({})).toBe("ok");
  });

  it("should fail immediately with zero retries", async () => {
    const t = mkTool("zero_fail", async () => { throw new Error("boom"); });
    const wrapped = retryTool(t, 0);
    await expect(wrapped.execute({})).rejects.toThrow("boom");
  });
});
