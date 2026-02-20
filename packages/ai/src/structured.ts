/**
 * Structured output generation for @openlinkos/ai.
 *
 * Provides `generateObject<T>()` which prompts a model to produce JSON
 * conforming to a given JSON Schema, validates the response, and retries
 * on validation failure (up to a configurable maximum).
 */

import type {
  Message,
  ModelConfig,
  JSONSchema,
  Usage,
} from "./types.js";
import type { Model, ModelRequestOptions } from "./index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for generateObject. */
export interface GenerateObjectOptions {
  /** Model config overrides (temperature, maxTokens, etc.). */
  config?: Partial<ModelConfig>;
  /** Request options (signal, etc.). */
  requestOptions?: ModelRequestOptions;
  /** Maximum validation retries (default: 3). */
  maxRetries?: number;
}

/** The result of generateObject. */
export interface GenerateObjectResult<T> {
  /** The parsed object conforming to the schema. */
  object: T;
  /** Aggregated token usage across all attempts. */
  usage: Usage;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a value against a JSON Schema (lightweight subset).
 * Returns an array of error strings (empty = valid).
 */
export function validateSchema(
  value: unknown,
  schema: JSONSchema,
  path: string = "$",
): string[] {
  const errors: string[] = [];

  if (value === null || value === undefined) {
    errors.push(`${path}: value is ${value === null ? "null" : "undefined"}`);
    return errors;
  }

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${Array.isArray(value) ? "array" : typeof value}`);
        return errors;
      }
      const obj = value as Record<string, unknown>;
      // Check required
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in obj)) {
            errors.push(`${path}: missing required property "${key}"`);
          }
        }
      }
      // Check property types
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            errors.push(...validateSchema(obj[key], propSchema, `${path}.${key}`));
          }
        }
      }
      break;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeof value}`);
        return errors;
      }
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          errors.push(...validateSchema(value[i], schema.items, `${path}[${i}]`));
        }
      }
      break;
    }
    case "string":
      if (typeof value !== "string") {
        errors.push(`${path}: expected string, got ${typeof value}`);
      } else if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: value "${value}" not in enum [${schema.enum.join(", ")}]`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        errors.push(`${path}: expected number, got ${typeof value}`);
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push(`${path}: expected integer, got ${typeof value === "number" ? "float" : typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`${path}: expected boolean, got ${typeof value}`);
      }
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

function addUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/**
 * Generate a structured object from a model that conforms to the given JSON Schema.
 *
 * The model is asked to produce JSON output. The response is parsed and validated
 * against the schema. On validation failure, the error is appended to the messages
 * and the model is retried (up to `maxRetries` times, default 3).
 *
 * @param model - The model to use for generation.
 * @param schema - JSON Schema describing the desired output structure.
 * @param messages - The conversation messages to send to the model.
 * @param options - Optional configuration.
 * @returns The parsed and validated object along with usage info.
 */
export async function generateObject<T = unknown>(
  model: Model,
  schema: JSONSchema,
  messages: Message[],
  options?: GenerateObjectOptions,
): Promise<GenerateObjectResult<T>> {
  const maxRetries = options?.maxRetries ?? 3;
  const config: Partial<ModelConfig> = {
    ...options?.config,
    responseFormat: { type: "json", schema },
  };
  const requestOptions = options?.requestOptions;

  // Build a working copy of messages with a schema instruction
  const schemaInstruction =
    `Respond with a JSON object that conforms to this schema:\n${JSON.stringify(schema, null, 2)}\n\nRespond ONLY with valid JSON, no other text.`;

  const workingMessages: Message[] = [
    ...messages,
    { role: "user", content: schemaInstruction },
  ];

  let totalUsage: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await model.generate(workingMessages, config, requestOptions);
    totalUsage = addUsage(totalUsage, response.usage);

    const text = (response.text ?? "").trim();

    // Try to parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (attempt < maxRetries) {
        workingMessages.push(
          { role: "assistant", content: text },
          {
            role: "user",
            content: `Your response was not valid JSON. Parse error: invalid JSON syntax. Please try again and respond with only valid JSON.`,
          },
        );
        continue;
      }
      throw new Error(
        `generateObject: failed to parse JSON after ${maxRetries + 1} attempts. Last response: ${text}`,
      );
    }

    // Validate against schema
    const validationErrors = validateSchema(parsed, schema);
    if (validationErrors.length === 0) {
      return { object: parsed as T, usage: totalUsage };
    }

    if (attempt < maxRetries) {
      workingMessages.push(
        { role: "assistant", content: text },
        {
          role: "user",
          content: `Your response did not match the required schema. Validation errors:\n${validationErrors.join("\n")}\n\nPlease fix these issues and respond with only valid JSON.`,
        },
      );
      continue;
    }

    throw new Error(
      `generateObject: schema validation failed after ${maxRetries + 1} attempts. Errors: ${validationErrors.join("; ")}`,
    );
  }

  // This should be unreachable, but TypeScript needs it
  throw new Error("generateObject: unexpected end of retry loop");
}
