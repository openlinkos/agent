/**
 * Tool system for @openlinkos/agent.
 *
 * Provides tool registration, parameter validation, and execution
 * with timeout and error handling.
 */

import type { ToolDefinition, JSONSchema } from "./types.js";

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

/**
 * A registry for managing available tools.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool.
   * @throws Error if a tool with the same name is already registered.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name.
   * @throws Error if the tool is not found.
   */
  get(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(
        `Tool "${name}" is not registered. Available tools: ${this.list().join(", ") || "(none)"}`,
      );
    }
    return tool;
  }

  /** Check if a tool is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** List all registered tool names. */
  list(): string[] {
    return [...this.tools.keys()];
  }

  /** Get all registered tool definitions. */
  all(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Remove all registered tools. */
  clear(): void {
    this.tools.clear();
  }
}

// ---------------------------------------------------------------------------
// Parameter validation
// ---------------------------------------------------------------------------

/** Result of a parameter validation check. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate parameters against a JSON Schema (basic validation).
 *
 * This is a lightweight validator that checks:
 * - Required properties are present
 * - Property types match (string, number, boolean, object, array)
 * - No unknown properties if additionalProperties is false
 */
export function validateParameters(
  params: Record<string, unknown>,
  schema: JSONSchema,
): ValidationResult {
  const errors: string[] = [];

  // Check required properties
  if (schema.required) {
    for (const key of schema.required) {
      if (!(key in params)) {
        errors.push(`Missing required parameter: "${key}"`);
      }
    }
  }

  // Check property types
  if (schema.properties) {
    for (const [key, value] of Object.entries(params)) {
      const propSchema = schema.properties[key];
      if (!propSchema) {
        if (schema.additionalProperties === false) {
          errors.push(`Unknown parameter: "${key}"`);
        }
        continue;
      }
      const typeError = checkType(value, propSchema, key);
      if (typeError) {
        errors.push(typeError);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkType(value: unknown, schema: JSONSchema, path: string): string | null {
  if (value === null || value === undefined) return null;

  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        return `Parameter "${path}" expected string, got ${typeof value}`;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        return `Parameter "${path}" must be one of: ${schema.enum.join(", ")}`;
      }
      break;
    case "number":
    case "integer":
      if (typeof value !== "number") {
        return `Parameter "${path}" expected number, got ${typeof value}`;
      }
      if (schema.type === "integer" && !Number.isInteger(value)) {
        return `Parameter "${path}" expected integer, got float`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return `Parameter "${path}" expected boolean, got ${typeof value}`;
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return `Parameter "${path}" expected array, got ${typeof value}`;
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        return `Parameter "${path}" expected object, got ${Array.isArray(value) ? "array" : typeof value}`;
      }
      break;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

/**
 * Execute a tool with timeout and error handling.
 *
 * @param tool - The tool to execute.
 * @param params - The parameters to pass to the tool.
 * @param timeoutMs - Maximum execution time in milliseconds.
 * @returns The tool result serialized as a string.
 */
export async function executeTool(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  timeoutMs: number = 30_000,
): Promise<{ result: string; error?: string }> {
  try {
    const result = await Promise.race([
      tool.execute(params),
      createTimeout(timeoutMs, tool.name),
    ]);

    // Serialize the result to a string
    const serialized = typeof result === "string" ? result : JSON.stringify(result);
    return { result: serialized };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: "", error: message };
  }
}

function createTimeout(ms: number, toolName: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`)),
      ms,
    );
  });
}
