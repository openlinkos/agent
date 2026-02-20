/**
 * @openlinkos/agent — Single agent engine.
 *
 * Define agents with system prompts, tools, guardrails, and lifecycle hooks.
 * Supports ReAct-style reasoning loops with full observability.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  JSONSchema,
  ToolDefinition,
  AgentStep,
  AgentHooks,
  AgentConfig,
  AgentResponse,
  AgentRunOptions,
  Agent,
} from "./types.js";

// Re-export AI types for convenience
export type {
  Model,
  Message,
  ModelResponse,
  ToolCall,
  Usage,
} from "./types.js";

// --- Tools ---
export {
  ToolRegistry,
  validateParameters,
  executeTool,
} from "./tools.js";
export type { ValidationResult } from "./tools.js";

// --- Guardrails ---
export type {
  GuardrailResult,
  InputGuardrail,
  OutputGuardrail,
  ContentFilter,
} from "./guardrails.js";
export {
  runInputGuardrails,
  runOutputGuardrails,
  applyContentFilters,
  maxLengthGuardrail,
  regexBlockFilter,
} from "./guardrails.js";

// --- Errors ---
export type { AgentErrorCode } from "./errors.js";
export { MaxIterationsError } from "./errors.js";
// Re-export shared errors from @openlinkos/ai
export { BaseError, ToolExecutionError, GuardrailError, AbortError } from "@openlinkos/ai";

// --- Agent engine ---
export { createAgentEngine } from "./agent.js";

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

import type { AgentConfig, Agent } from "./types.js";
import { createAgentEngine } from "./agent.js";

/**
 * Create a new agent instance.
 *
 * @param config - Agent configuration including model, prompts, and tools.
 * @returns An Agent instance ready to process user input.
 *
 * @example
 * ```typescript
 * import { createModel, registerProvider, createOpenAIProvider } from "@openlinkos/ai";
 * import { createAgent } from "@openlinkos/agent";
 *
 * registerProvider(createOpenAIProvider());
 * const model = createModel("openai:gpt-4o");
 * const agent = createAgent({
 *   name: "assistant",
 *   model,
 *   systemPrompt: "You are a helpful assistant.",
 *   tools: [{
 *     name: "get_weather",
 *     description: "Get the current weather",
 *     parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
 *     execute: async (params) => ({ temp: 72, city: params.city }),
 *   }],
 * });
 *
 * const response = await agent.run("What's the weather in Tokyo?");
 * console.log(response.text);
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  return createAgentEngine(config);
}
