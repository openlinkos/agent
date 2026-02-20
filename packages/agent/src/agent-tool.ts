/**
 * Agent-as-Tool for @openlinkos/agent.
 *
 * Wraps an Agent instance as a ToolDefinition so it can be used
 * as a tool by another agent, enabling hierarchical agent composition.
 *
 * Includes depth tracking to prevent infinite recursion.
 */

import type { Agent, ToolDefinition, JSONSchema } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating an agent-as-tool. */
export interface AgentAsToolOptions {
  /** Description for the tool. Defaults to "Run agent: <agentName>". */
  description?: string;
  /** Maximum nesting depth (default: 3). */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Depth tracking
// ---------------------------------------------------------------------------

/** Current nesting depth, tracked via a module-level counter. */
let currentDepth = 0;

/**
 * Get the current agent-as-tool nesting depth.
 * Useful for testing.
 */
export function getCurrentDepth(): number {
  return currentDepth;
}

/**
 * Reset the depth counter. Useful for testing.
 */
export function resetDepth(): void {
  currentDepth = 0;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Wrap an agent as a ToolDefinition.
 *
 * The resulting tool accepts a JSON object with a `query` string parameter
 * and returns the agent's text response.
 *
 * @param agent - The agent to wrap.
 * @param options - Optional configuration.
 * @returns A ToolDefinition that delegates to the agent.
 */
export function agentAsTool(
  agent: Agent,
  options?: AgentAsToolOptions,
): ToolDefinition {
  const maxDepth = options?.maxDepth ?? 3;
  const description =
    options?.description ?? `Run agent: ${agent.name}`;

  const parameters: JSONSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The input query to send to the agent",
      },
    },
    required: ["query"],
  };

  return {
    name: `agent_${agent.name}`,
    description,
    parameters,
    async execute(params: Record<string, unknown>): Promise<unknown> {
      const query = params.query as string;

      if (currentDepth >= maxDepth) {
        throw new Error(
          `Agent-as-tool maximum depth exceeded (${maxDepth}). ` +
          `Agent "${agent.name}" cannot be called at depth ${currentDepth}.`,
        );
      }

      currentDepth++;
      try {
        const response = await agent.run(query);
        return response.text;
      } finally {
        currentDepth--;
      }
    },
  };
}
