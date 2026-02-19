/**
 * @openlinkos/agent — Single agent engine.
 *
 * Define agents with system prompts, tools, guardrails, and lifecycle hooks.
 * Supports ReAct-style reasoning loops with full observability.
 *
 * @packageDocumentation
 */

import type { Model, ModelResponse } from "@openlinkos/ai";

export interface ToolDefinition {
  /** Unique name for the tool. */
  name: string;
  /** Human-readable description of what the tool does. */
  description: string;
  /** JSON Schema describing the tool's input parameters. */
  parameters: Record<string, unknown>;
  /** The function to execute when the tool is called. */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentConfig {
  /** Unique name identifying the agent. */
  name: string;
  /** The model instance to use for generation. */
  model: Model;
  /** System prompt defining the agent's behavior. */
  systemPrompt: string;
  /** Tools available to the agent. */
  tools?: ToolDefinition[];
  /** Maximum number of reasoning loop iterations. Defaults to 10. */
  maxIterations?: number;
}

export interface AgentResponse {
  /** The final text response from the agent. */
  text: string;
  /** The sequence of model responses during the reasoning loop. */
  steps: ModelResponse[];
  /** The agent's name. */
  agentName: string;
}

export interface Agent {
  /** The agent's name. */
  readonly name: string;
  /** Run the agent with the given user input. */
  run(input: string): Promise<AgentResponse>;
}

/**
 * Create a new agent instance.
 *
 * @param config - Agent configuration including model, prompts, and tools.
 * @returns An Agent instance ready to process user input.
 *
 * @example
 * ```typescript
 * import { createModel } from "@openlinkos/ai";
 * import { createAgent } from "@openlinkos/agent";
 *
 * const model = createModel("openai:gpt-4o");
 * const agent = createAgent({
 *   name: "assistant",
 *   model,
 *   systemPrompt: "You are a helpful assistant.",
 * });
 *
 * const response = await agent.run("What is TypeScript?");
 * console.log(response.text);
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  return {
    name: config.name,
    async run(_input: string): Promise<AgentResponse> {
      throw new Error(
        `Agent "${config.name}" execution is not yet implemented. This is a scaffold — the agent engine is coming in Phase 1.`
      );
    },
  };
}
