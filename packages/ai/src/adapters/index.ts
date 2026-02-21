/**
 * Provider Adapters for @openlinkos/ai.
 *
 * Provides unified base classes for OpenAI-compatible and Anthropic-compatible
 * providers, reducing code duplication and simplifying provider implementation.
 */

// OpenAI-compatible adapter
export {
  OpenAIAdapter,
  toOpenAIMessages,
  toOpenAITools,
  parseToolCalls,
  parseFunctionCall,
  parseFinishReason,
  parseUsage,
  type OpenAIMessage,
  type OpenAIToolCall,
  type OpenAITool,
  type OpenAIChatResponse,
  type OpenAIStreamChunk,
  type OpenAIAdapterConfig,
} from "./openai-adapter.js";

// Anthropic-compatible adapter
export {
  AnthropicAdapter,
  toAnthropicMessages,
  toAnthropicTools,
  parseAnthropicToolCalls,
  parseAnthropicText,
  parseAnthropicFinishReason,
  parseAnthropicUsage,
  parseRateLimitHeaders,
  type AnthropicMessage,
  type AnthropicContent,
  type AnthropicTool,
  type AnthropicResponse,
  type AnthropicStreamEvent,
  type AnthropicAdapterConfig,
} from "./anthropic-adapter.js";
