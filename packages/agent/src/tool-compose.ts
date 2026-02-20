/**
 * Tool composition utilities for @openlinkos/agent.
 *
 * Provides higher-order functions for combining, wrapping, and organizing tools:
 * - composeTool: chain tools sequentially, piping output as input
 * - conditionalTool: pick a tool based on a runtime condition
 * - toolGroup: namespace a set of tools under a group prefix
 * - retryTool: wrap a tool with automatic retry logic
 */

import type { ToolDefinition, JSONSchema } from "./types.js";

// ---------------------------------------------------------------------------
// composeTool
// ---------------------------------------------------------------------------

/**
 * Chain multiple tools sequentially, piping the output of each tool
 * as the input to the next.
 *
 * The first tool receives the original parameters. Each subsequent tool
 * receives `{ input: <previous result> }` where the previous result is
 * the stringified output of the prior tool.
 *
 * @param tools - Tools to chain in order.
 * @param name - Name for the composed tool.
 * @param description - Description for the composed tool.
 * @returns A new ToolDefinition that executes the chain.
 */
export function composeTool(
  tools: ToolDefinition[],
  name: string,
  description: string,
): ToolDefinition {
  if (tools.length === 0) {
    throw new Error("composeTool requires at least one tool.");
  }

  const parameters: JSONSchema = tools[0].parameters;

  return {
    name,
    description,
    parameters,
    async execute(params: Record<string, unknown>): Promise<unknown> {
      let result: unknown = await tools[0].execute(params);

      for (let i = 1; i < tools.length; i++) {
        const input = typeof result === "string" ? result : JSON.stringify(result);
        result = await tools[i].execute({ input });
      }

      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// conditionalTool
// ---------------------------------------------------------------------------

/**
 * Pick a tool to execute based on a runtime condition.
 *
 * @param condition - A function that receives the parameters and returns true/false.
 * @param toolA - Tool to execute when condition returns true.
 * @param toolB - Tool to execute when condition returns false.
 * @returns A new ToolDefinition that delegates to the chosen tool.
 */
export function conditionalTool(
  condition: (params: Record<string, unknown>) => boolean | Promise<boolean>,
  toolA: ToolDefinition,
  toolB: ToolDefinition,
): ToolDefinition {
  const mergedProperties: Record<string, JSONSchema> = {
    ...toolA.parameters.properties,
    ...toolB.parameters.properties,
  };

  const mergedRequired = [
    ...new Set([
      ...(toolA.parameters.required ?? []),
      ...(toolB.parameters.required ?? []),
    ]),
  ];

  const parameters: JSONSchema = {
    type: "object",
    properties: mergedProperties,
    ...(mergedRequired.length > 0 ? { required: mergedRequired } : {}),
  };

  return {
    name: `${toolA.name}_or_${toolB.name}`,
    description: `Conditional: ${toolA.description} OR ${toolB.description}`,
    parameters,
    async execute(params: Record<string, unknown>): Promise<unknown> {
      const useA = await condition(params);
      return useA ? toolA.execute(params) : toolB.execute(params);
    },
  };
}

// ---------------------------------------------------------------------------
// toolGroup
// ---------------------------------------------------------------------------

/**
 * Namespace a set of tools under a group prefix.
 *
 * Each tool's name is prefixed with `groupName_` to create a namespaced
 * collection. Descriptions are also prefixed with the group name.
 *
 * @param tools - Tools to include in the group.
 * @param groupName - The namespace prefix for tool names.
 * @param description - Description for the group (used as prefix in tool descriptions).
 * @returns An array of new ToolDefinitions with namespaced names.
 */
export function toolGroup(
  tools: ToolDefinition[],
  groupName: string,
  description: string,
): ToolDefinition[] {
  return tools.map((tool) => ({
    name: `${groupName}_${tool.name}`,
    description: `[${description}] ${tool.description}`,
    parameters: tool.parameters,
    execute: tool.execute,
  }));
}

// ---------------------------------------------------------------------------
// retryTool
// ---------------------------------------------------------------------------

/**
 * Wrap a tool with automatic retry logic.
 *
 * If the tool's execute function throws, it will be retried up to
 * `maxRetries` times. The last error is re-thrown if all attempts fail.
 *
 * @param tool - The tool to wrap.
 * @param maxRetries - Maximum number of retry attempts (default: 3).
 * @returns A new ToolDefinition with retry behavior.
 */
export function retryTool(
  tool: ToolDefinition,
  maxRetries: number = 3,
): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    async execute(params: Record<string, unknown>): Promise<unknown> {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await tool.execute(params);
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt === maxRetries) {
            break;
          }
        }
      }

      throw lastError;
    },
  };
}
