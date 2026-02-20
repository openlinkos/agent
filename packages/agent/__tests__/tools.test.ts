/**
 * Tests for the tool system.
 */

import { describe, it, expect, vi } from "vitest";
import { ToolRegistry, validateParameters, executeTool } from "../src/tools.js";
import type { ToolDefinition } from "../src/types.js";

// ---------------------------------------------------------------------------
// ToolRegistry
// ---------------------------------------------------------------------------

describe("ToolRegistry", () => {
  it("should register and retrieve a tool", () => {
    const registry = new ToolRegistry();
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object" },
      execute: async () => "result",
    };

    registry.register(tool);
    expect(registry.has("test_tool")).toBe(true);
    expect(registry.get("test_tool")).toBe(tool);
  });

  it("should throw on duplicate registration", () => {
    const registry = new ToolRegistry();
    const tool: ToolDefinition = {
      name: "dup",
      description: "test",
      parameters: { type: "object" },
      execute: async () => "result",
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow(
      'Tool "dup" is already registered',
    );
  });

  it("should throw when getting unregistered tool", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("missing")).toThrow(
      'Tool "missing" is not registered',
    );
  });

  it("should list all tool names", () => {
    const registry = new ToolRegistry();
    const mkTool = (name: string): ToolDefinition => ({
      name,
      description: name,
      parameters: { type: "object" },
      execute: async () => name,
    });

    registry.register(mkTool("alpha"));
    registry.register(mkTool("beta"));
    registry.register(mkTool("gamma"));

    expect(registry.list()).toEqual(["alpha", "beta", "gamma"]);
  });

  it("should return all tool definitions", () => {
    const registry = new ToolRegistry();
    const tool: ToolDefinition = {
      name: "my_tool",
      description: "My tool",
      parameters: { type: "object" },
      execute: async () => "result",
    };
    registry.register(tool);

    const allTools = registry.all();
    expect(allTools).toHaveLength(1);
    expect(allTools[0].name).toBe("my_tool");
  });

  it("should clear all tools", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "t1",
      description: "t",
      parameters: { type: "object" },
      execute: async () => "r",
    });
    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.has("t1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateParameters
// ---------------------------------------------------------------------------

describe("validateParameters", () => {
  it("should pass valid parameters", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const result = validateParameters({ name: "Alice", age: 30 }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail on missing required parameter", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };

    const result = validateParameters({}, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required parameter: "name"');
  });

  it("should fail on wrong type", () => {
    const schema = {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    };

    const result = validateParameters({ count: "not a number" }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected number");
  });

  it("should validate string type", () => {
    const schema = {
      type: "object",
      properties: { s: { type: "string" } },
    };
    expect(validateParameters({ s: "hello" }, schema).valid).toBe(true);
    expect(validateParameters({ s: 123 }, schema).valid).toBe(false);
  });

  it("should validate boolean type", () => {
    const schema = {
      type: "object",
      properties: { b: { type: "boolean" } },
    };
    expect(validateParameters({ b: true }, schema).valid).toBe(true);
    expect(validateParameters({ b: "true" }, schema).valid).toBe(false);
  });

  it("should validate array type", () => {
    const schema = {
      type: "object",
      properties: { arr: { type: "array" } },
    };
    expect(validateParameters({ arr: [1, 2, 3] }, schema).valid).toBe(true);
    expect(validateParameters({ arr: "not array" }, schema).valid).toBe(false);
  });

  it("should validate object type", () => {
    const schema = {
      type: "object",
      properties: { obj: { type: "object" } },
    };
    expect(validateParameters({ obj: { a: 1 } }, schema).valid).toBe(true);
    expect(validateParameters({ obj: [1, 2] }, schema).valid).toBe(false);
    expect(validateParameters({ obj: "string" }, schema).valid).toBe(false);
  });

  it("should validate integer type", () => {
    const schema = {
      type: "object",
      properties: { n: { type: "integer" } },
    };
    expect(validateParameters({ n: 42 }, schema).valid).toBe(true);
    expect(validateParameters({ n: 3.14 }, schema).valid).toBe(false);
  });

  it("should validate enum values", () => {
    const schema = {
      type: "object",
      properties: {
        color: { type: "string", enum: ["red", "green", "blue"] },
      },
    };
    expect(validateParameters({ color: "red" }, schema).valid).toBe(true);
    expect(validateParameters({ color: "yellow" }, schema).valid).toBe(false);
  });

  it("should handle unknown properties when additionalProperties is false", () => {
    const schema = {
      type: "object",
      properties: { known: { type: "string" } },
      additionalProperties: false,
    };

    const result = validateParameters({ known: "ok", unknown: "bad" }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unknown parameter: "unknown"');
  });

  it("should allow unknown properties by default", () => {
    const schema = {
      type: "object",
      properties: { known: { type: "string" } },
    };

    const result = validateParameters({ known: "ok", extra: "fine" }, schema);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeTool
// ---------------------------------------------------------------------------

describe("executeTool", () => {
  it("should execute a tool and return string result", async () => {
    const tool: ToolDefinition = {
      name: "echo",
      description: "Echoes input",
      parameters: { type: "object" },
      execute: async (params) => `Echo: ${params.text}`,
    };

    const { result, error } = await executeTool(tool, { text: "hello" });
    expect(result).toBe("Echo: hello");
    expect(error).toBeUndefined();
  });

  it("should serialize non-string results as JSON", async () => {
    const tool: ToolDefinition = {
      name: "json_tool",
      description: "Returns JSON",
      parameters: { type: "object" },
      execute: async () => ({ key: "value", count: 42 }),
    };

    const { result, error } = await executeTool(tool, {});
    expect(result).toBe(JSON.stringify({ key: "value", count: 42 }));
    expect(error).toBeUndefined();
  });

  it("should handle tool execution errors", async () => {
    const tool: ToolDefinition = {
      name: "fail",
      description: "Fails",
      parameters: { type: "object" },
      execute: async () => {
        throw new Error("Boom!");
      },
    };

    const { result, error } = await executeTool(tool, {});
    expect(result).toBe("");
    expect(error).toBe("Boom!");
  });

  it("should timeout slow tools", async () => {
    const tool: ToolDefinition = {
      name: "slow",
      description: "Takes too long",
      parameters: { type: "object" },
      execute: async () =>
        new Promise((resolve) => setTimeout(() => resolve("done"), 5000)),
    };

    const { result, error } = await executeTool(tool, {}, 50);
    expect(result).toBe("");
    expect(error).toContain("timed out");
  });
});
