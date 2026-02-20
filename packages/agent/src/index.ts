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

// --- Middleware ---
export { MiddlewareStack } from "./middleware.js";
export type {
  Middleware,
  NextFn,
  BeforeGenerateContext,
  AfterGenerateContext,
  BeforeToolCallContext,
  AfterToolCallContext,
  ErrorContext,
} from "./middleware.js";

// --- Built-in middlewares ---
export {
  createLoggingMiddleware,
  createCachingMiddleware,
  createCostTrackingMiddleware,
} from "./middlewares/index.js";
export type {
  LoggingOptions,
  CachingOptions,
  CostPricing,
  CostSnapshot,
} from "./middlewares/index.js";

// --- Plugin ---
export type { Plugin } from "./plugin.js";

// --- Tracer ---
export { Tracer } from "./tracer.js";
export type {
  Trace,
  Span,
  SpanStatus,
  SpanEvent,
  TraceExporter,
  TracerOptions,
} from "./tracer.js";

// --- Exporters ---
export {
  createConsoleExporter,
  createJsonExporter,
  createCallbackExporter,
} from "./exporters/index.js";
export type {
  ConsoleExporterOptions,
  JsonExporterOptions,
  TraceCallback,
} from "./exporters/index.js";

// --- Agent engine ---
export { createAgentEngine } from "./agent.js";

// --- Conversation ---
export { Conversation, createConversation } from "./conversation.js";
export type { ConversationOptions } from "./conversation.js";

// --- Context window ---
export {
  CharBasedTokenCounter,
  SlidingWindowStrategy,
} from "./context-window.js";
export type {
  TokenCounter,
  SlidingWindowOptions,
} from "./context-window.js";

// --- Session ---
export { SessionManager } from "./session.js";
export type { SessionManagerOptions } from "./session.js";

// --- Persistence ---
export { InMemoryStore, FileStore } from "./persistence.js";
export type {
  ConversationStore,
  ConversationData,
} from "./persistence.js";

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
