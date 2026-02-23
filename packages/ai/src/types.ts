/**
 * Core types for the @openlinkos/ai package.
 *
 * Defines message types, tool schemas, model capabilities, usage tracking,
 * and structured output formats.
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** System message to set the model's behavior. */
export interface SystemMessage {
  role: "system";
  content: string;
}

/** User message containing the human's input. */
export interface UserMessage {
  role: "user";
  content: string;
}

/** A tool call requested by the assistant. */
export interface ToolCall {
  /** Unique ID for this tool call, used to correlate results. */
  id: string;
  /** The name of the tool to invoke. */
  name: string;
  /** The JSON-serializable arguments for the tool. */
  arguments: Record<string, unknown>;
}

/** Assistant message, optionally containing tool calls. */
export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  toolCalls?: ToolCall[];
}

/** A result returned from a tool execution. */
export interface ToolMessage {
  role: "tool";
  /** The tool call ID this result corresponds to. */
  toolCallId: string;
  /** The tool's output, serialized as a string. */
  content: string;
}

/** Union of all message types. */
export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

/** JSON Schema subset used to describe tool parameters. */
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

/** A tool definition that can be provided to the model. */
export interface ToolDefinition {
  /** The tool's name (must be unique within a request). */
  name: string;
  /** Human-readable description of the tool. */
  description: string;
  /** JSON Schema describing the tool's expected parameters. */
  parameters: JSONSchema;
}

// ---------------------------------------------------------------------------
// Structured output / response format
// ---------------------------------------------------------------------------

/** Request that the model output valid JSON matching a schema. */
export interface JSONResponseFormat {
  type: "json";
  /** Optional JSON Schema the output must conform to. */
  schema?: JSONSchema;
}

/** Request plain text output (default). */
export interface TextResponseFormat {
  type: "text";
}

export type ResponseFormat = TextResponseFormat | JSONResponseFormat;

// ---------------------------------------------------------------------------
// Usage / token tracking
// ---------------------------------------------------------------------------

/** Token usage statistics for a single generation. */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for a model invocation.
 */
export interface ModelConfig {
  /** Model identifier in "provider:model" format (e.g. "anthropic:claude-sonnet-4-5"). */
  model: string;
  /** API key override. Defaults to environment variable per provider. */
  apiKey?: string;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Custom base URL for the provider API. */
  baseURL?: string;
  /** Response format specification. */
  responseFormat?: ResponseFormat;
  /** Stop sequences. */
  stop?: string[];
  /** Top-p sampling. */
  topP?: number;
}

// ---------------------------------------------------------------------------
// Model response
// ---------------------------------------------------------------------------

/** A complete (non-streaming) model response. */
export interface ModelResponse {
  /** The generated text (may be null if only tool calls are returned). */
  text: string | null;
  /** Tool calls requested by the model. */
  toolCalls: ToolCall[];
  /** Token usage for this response. */
  usage: Usage;
  /** The finish reason reported by the provider. */
  finishReason: FinishReason;
  /** Extracted reasoning content from <think> tags (if present). */
  reasoning?: string | null;
}

export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "error" | "unknown";

// ---------------------------------------------------------------------------
// Model capabilities
// ---------------------------------------------------------------------------

/** Declares what a model/provider supports. */
export interface ModelCapabilities {
  /** Supports streaming responses. */
  streaming: boolean;
  /** Supports tool/function calling. */
  toolCalling: boolean;
  /** Supports structured JSON output. */
  structuredOutput: boolean;
  /** Supports system messages. */
  systemMessages: boolean;
  /** Supports vision/image inputs. */
  vision: boolean;
}
