/**
 * Tests for structured output generation.
 */

import { describe, it, expect, vi } from "vitest";
import { generateObject, validateSchema } from "../src/structured.js";
import type { Model } from "../src/index.js";
import type { Message, ModelResponse, Usage } from "../src/types.js";
import type { StreamResult } from "../src/stream.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUsage(n: number = 10): Usage {
  return { promptTokens: n, completionTokens: n, totalTokens: n * 2 };
}

function makeResponse(text: string, usage?: Usage): ModelResponse {
  return {
    text,
    toolCalls: [],
    usage: usage ?? makeUsage(),
    finishReason: "stop",
  };
}

function createMockModel(responses: ModelResponse[]): Model {
  let callIndex = 0;
  return {
    modelId: "mock:test-model",
    async generate(_messages: Message[]): Promise<ModelResponse> {
      return responses[callIndex++] ?? makeResponse("{}");
    },
    async stream(): Promise<StreamResult> {
      throw new Error("Stream not implemented in mock");
    },
    async generateWithTools(): Promise<ModelResponse> {
      throw new Error("generateWithTools not implemented in mock");
    },
  };
}

// ---------------------------------------------------------------------------
// validateSchema
// ---------------------------------------------------------------------------

describe("validateSchema", () => {
  it("should validate a correct object", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };
    const errors = validateSchema({ name: "Alice", age: 30 }, schema);
    expect(errors).toHaveLength(0);
  });

  it("should detect missing required property", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    const errors = validateSchema({}, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("name");
  });

  it("should detect wrong type", () => {
    const schema = {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    };
    const errors = validateSchema({ count: "not a number" }, schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("number");
  });

  it("should validate arrays", () => {
    const schema = {
      type: "array",
      items: { type: "string" },
    };
    expect(validateSchema(["a", "b"], schema)).toHaveLength(0);
    expect(validateSchema("not array", schema).length).toBeGreaterThan(0);
  });

  it("should validate nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
    };
    expect(validateSchema({ address: { city: "NYC" } }, schema)).toHaveLength(0);
    expect(validateSchema({ address: {} }, schema).length).toBeGreaterThan(0);
  });

  it("should validate boolean type", () => {
    const schema = { type: "boolean" };
    expect(validateSchema(true, schema)).toHaveLength(0);
    expect(validateSchema("true", schema).length).toBeGreaterThan(0);
  });

  it("should validate integer type", () => {
    const schema = { type: "integer" };
    expect(validateSchema(42, schema)).toHaveLength(0);
    expect(validateSchema(3.14, schema).length).toBeGreaterThan(0);
  });

  it("should validate enum values", () => {
    const schema = { type: "string", enum: ["red", "green", "blue"] };
    expect(validateSchema("red", schema)).toHaveLength(0);
    expect(validateSchema("yellow", schema).length).toBeGreaterThan(0);
  });

  it("should report null and undefined", () => {
    const schema = { type: "string" };
    expect(validateSchema(null, schema).length).toBeGreaterThan(0);
    expect(validateSchema(undefined, schema).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateObject
// ---------------------------------------------------------------------------

describe("generateObject", () => {
  it("should return a valid object on first attempt", async () => {
    const model = createMockModel([
      makeResponse(JSON.stringify({ name: "Alice", age: 30 })),
    ]);

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const { object, usage } = await generateObject<{ name: string; age: number }>(
      model,
      schema,
      [{ role: "user", content: "Generate a person" }],
    );

    expect(object.name).toBe("Alice");
    expect(object.age).toBe(30);
    expect(usage.totalTokens).toBeGreaterThan(0);
  });

  it("should retry on validation failure and succeed", async () => {
    const model = createMockModel([
      // First attempt: missing required field
      makeResponse(JSON.stringify({ age: 25 })),
      // Second attempt: correct
      makeResponse(JSON.stringify({ name: "Bob", age: 25 })),
    ]);

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const { object, usage } = await generateObject<{ name: string; age: number }>(
      model,
      schema,
      [{ role: "user", content: "Generate a person" }],
    );

    expect(object.name).toBe("Bob");
    // Usage should be aggregated across both attempts
    expect(usage.totalTokens).toBe(40);
  });

  it("should retry on invalid JSON and succeed", async () => {
    const model = createMockModel([
      // First attempt: invalid JSON
      makeResponse("not json at all"),
      // Second attempt: valid
      makeResponse(JSON.stringify({ value: 42 })),
    ]);

    const schema = {
      type: "object",
      properties: {
        value: { type: "number" },
      },
      required: ["value"],
    };

    const { object } = await generateObject<{ value: number }>(
      model,
      schema,
      [{ role: "user", content: "Generate a number" }],
    );

    expect(object.value).toBe(42);
  });

  it("should throw after max retries exceeded (validation)", async () => {
    const model = createMockModel([
      makeResponse(JSON.stringify({ wrong: "data" })),
      makeResponse(JSON.stringify({ wrong: "data" })),
      makeResponse(JSON.stringify({ wrong: "data" })),
      makeResponse(JSON.stringify({ wrong: "data" })),
    ]);

    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };

    await expect(
      generateObject(model, schema, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("schema validation failed after 4 attempts");
  });

  it("should throw after max retries exceeded (JSON parse)", async () => {
    const model = createMockModel([
      makeResponse("not json"),
      makeResponse("still not json"),
      makeResponse("nope"),
      makeResponse("nah"),
    ]);

    const schema = { type: "object" };

    await expect(
      generateObject(model, schema, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("failed to parse JSON after 4 attempts");
  });

  it("should respect custom maxRetries", async () => {
    const model = createMockModel([
      makeResponse("bad"),
      makeResponse("bad"),
    ]);

    const schema = { type: "object" };

    await expect(
      generateObject(model, schema, [{ role: "user", content: "test" }], {
        maxRetries: 1,
      }),
    ).rejects.toThrow("failed to parse JSON after 2 attempts");
  });

  it("should pass responseFormat through to model config", async () => {
    const generateFn = vi.fn().mockResolvedValue(
      makeResponse(JSON.stringify({ ok: true })),
    );
    const model: Model = {
      modelId: "mock:test",
      generate: generateFn,
      async stream() {
        throw new Error("not implemented");
      },
      async generateWithTools() {
        throw new Error("not implemented");
      },
    };

    const schema = {
      type: "object",
      properties: { ok: { type: "boolean" } },
    };

    await generateObject(model, schema, [{ role: "user", content: "test" }]);

    // Check that responseFormat was passed
    const configArg = generateFn.mock.calls[0][1];
    expect(configArg.responseFormat).toEqual({ type: "json", schema });
  });

  it("should aggregate usage across retries", async () => {
    const model = createMockModel([
      makeResponse(JSON.stringify({ wrong: true }), makeUsage(5)),
      makeResponse(JSON.stringify({ name: "OK" }), makeUsage(7)),
    ]);

    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };

    const { usage } = await generateObject(
      model,
      schema,
      [{ role: "user", content: "test" }],
    );

    expect(usage.promptTokens).toBe(12);
    expect(usage.completionTokens).toBe(12);
    expect(usage.totalTokens).toBe(24);
  });
});
