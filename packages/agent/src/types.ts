/**
 * Core types for the @openlinkos/agent package.
 *
 * Defines agent configuration, responses, tool definitions with execute functions,
 * and lifecycle hooks for full observability.
 */

import type { Model, ModelResponse, ToolCall, Usage } from "@openlinkos/ai";
import type { InputGuardrail, OutputGuardrail, ContentFilter } from "./guardrails.js";

// ---------------------------------------------------------------------------
// Tool definition (with execute function)
// ---------------------------------------------------------------------------

/** JSON Schema for tool parameters. */
export interface JSONSchema {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

/** A tool that the agent can invoke during reasoning. */
export interface ToolDefinition {
  /** Unique tool name. */
  name: string;
  /** Human-readable description of what the tool does. */
  description: string;
  /** JSON Schema describing the expected parameters. */
  parameters: JSONSchema;
  /** The function to execute when the tool is called. */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Agent hooks
// ---------------------------------------------------------------------------

/** A single step in the agent's reasoning loop. */
export interface AgentStep {
  /** The step number (1-indexed). */
  stepNumber: number;
  /** The model response for this step. */
  modelResponse: ModelResponse;
  /** Tool calls made during this step. */
  toolCalls: Array<{
    call: ToolCall;
    result: string;
    error?: string;
  }>;
}

/** Lifecycle hooks for observing and controlling agent execution. */
export interface AgentHooks {
  /** Called when the agent starts processing input. */
  onStart?: (input: string) => void | Promise<void>;
  /** Called before a tool is executed. Return false to block execution. */
  onToolCall?: (toolCall: ToolCall) => void | boolean | Promise<void | boolean>;
  /** Called after a tool produces a result. */
  onToolResult?: (toolCall: ToolCall, result: string) => void | Promise<void>;
  /** Called after each reasoning step completes. */
  onStep?: (step: AgentStep) => void | Promise<void>;
  /** Called when the agent finishes. */
  onEnd?: (response: AgentResponse) => void | Promise<void>;
  /** Called when an error occurs. */
  onError?: (error: Error) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

/** Configuration for creating an agent. */
export interface AgentConfig {
  /** Unique name identifying the agent. */
  name: string;
  /** The model instance to use for generation. */
  model: Model;
  /** System prompt defining the agent's behavior. */
  systemPrompt: string;
  /** Tools available to the agent. */
  tools?: ToolDefinition[];
  /** Maximum number of reasoning loop iterations. Default: 10. */
  maxIterations?: number;
  /** Lifecycle hooks for observability. */
  hooks?: AgentHooks;
  /** Timeout in milliseconds for individual tool executions. Default: 30000. */
  toolTimeout?: number;
  /** Input guardrails run before the first model call. */
  inputGuardrails?: InputGuardrail[];
  /** Output guardrails run before returning the final response. */
  outputGuardrails?: OutputGuardrail[];
  /** Content filters applied to the final response text. */
  contentFilters?: ContentFilter[];
}

// ---------------------------------------------------------------------------
// Agent response
// ---------------------------------------------------------------------------

/** The final response from an agent run. */
export interface AgentResponse {
  /** The final text response from the agent. */
  text: string;
  /** All steps taken during the reasoning loop. */
  steps: AgentStep[];
  /** All tool calls made during the run. */
  toolCalls: ToolCall[];
  /** Aggregated usage across all model invocations. */
  usage: Usage;
  /** The agent's name. */
  agentName: string;
}

// ---------------------------------------------------------------------------
// Agent interface
// ---------------------------------------------------------------------------

/** A configured agent ready to process input. */
export interface Agent {
  /** The agent's name. */
  readonly name: string;
  /** Run the agent with the given user input. */
  run(input: string): Promise<AgentResponse>;
}

// Re-export Model-related types from @openlinkos/ai for convenience
export type { Model, Message, ModelResponse, ToolCall, Usage } from "@openlinkos/ai";
