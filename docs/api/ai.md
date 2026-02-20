# @openlinkos/ai

Unified model invocation layer for LLM providers.

## Installation

```bash
pnpm add @openlinkos/ai
```

## Overview

`@openlinkos/ai` provides a single interface for interacting with multiple LLM providers. Write your agent logic once and swap models without changing application code.

### Supported Providers

| Provider | Models | Env Variable |
|----------|--------|-------------|
| OpenAI | GPT-4o, GPT-4, GPT-3.5 | `OPENAI_API_KEY` |
| Anthropic | Claude 3.5, Claude 3 | `ANTHROPIC_API_KEY` |
| Google Gemini | Gemini Pro, Gemini Ultra | `GOOGLE_API_KEY` |
| Ollama | Any local model | — |

## `createModel()`

Create a model instance from a `provider:model` identifier.

```typescript
import { createModel } from "@openlinkos/ai";

const model = createModel("openai:gpt-4o");
```

**Signature:**

```typescript
function createModel(modelId: string, config?: ModelConfig): Model
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `modelId` | `string` | Provider and model in `provider:model` format |
| `config` | `ModelConfig` | Optional model configuration |

## `ModelConfig`

```typescript
interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  responseFormat?: ResponseFormat;
}
```

## `Model`

The model interface returned by `createModel()`.

```typescript
interface Model {
  readonly modelId: string;
  generate(messages: Message[], config?: ModelConfig): Promise<ModelResponse>;
  stream(messages: Message[], config?: ModelConfig): Promise<StreamResult>;
  generateWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    config?: ModelConfig,
  ): Promise<ModelResponse>;
}
```

### `model.generate()`

Generate a response from a list of messages.

```typescript
const response = await model.generate([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "What is TypeScript?" },
]);

console.log(response.text);
console.log(response.usage); // { promptTokens, completionTokens, totalTokens }
```

### `model.stream()`

Stream a response token-by-token.

```typescript
const stream = await model.stream([
  { role: "user", content: "Tell me a story." },
]);

for await (const event of stream.events) {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
  }
}
```

### `model.generateWithTools()`

Generate a response with tool calling support.

```typescript
const response = await model.generateWithTools(
  [{ role: "user", content: "What's the weather in Tokyo?" }],
  [
    {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  ],
);

if (response.toolCalls.length > 0) {
  console.log(response.toolCalls[0].name);      // "get_weather"
  console.log(response.toolCalls[0].arguments);  // { city: "Tokyo" }
}
```

## `ModelResponse`

```typescript
interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  usage: Usage;
  finishReason: FinishReason;
}
```

## Message Types

```typescript
type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

interface SystemMessage {
  role: "system";
  content: string;
}

interface UserMessage {
  role: "user";
  content: string;
}

interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

interface ToolMessage {
  role: "tool";
  toolCallId: string;
  content: string;
}
```

## Streaming

### Stream Events

```typescript
type StreamEvent = TextDelta | ToolCallDelta | UsageDelta | StreamDone;

interface TextDelta {
  type: "text-delta";
  text: string;
}

interface ToolCallDelta {
  type: "tool-call-delta";
  toolCallId: string;
  name: string;
  arguments: string;
}

interface UsageDelta {
  type: "usage-delta";
  usage: Usage;
}

interface StreamDone {
  type: "done";
}
```

### Stream Utilities

```typescript
import { collectText, collectEvents, mapStream, filterStream } from "@openlinkos/ai";

// Collect the full text from a stream
const text = await collectText(stream);

// Collect all events
const events = await collectEvents(stream);

// Transform stream events
const mapped = mapStream(stream, (event) => {
  // transform event
  return event;
});
```

## Retry and Fallback

### `withRetry()`

Wrap a model with automatic retry on transient failures.

```typescript
import { withRetry } from "@openlinkos/ai";

const resilientModel = withRetry(model, {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
});
```

### `createFallback()`

Create a model that falls back to alternatives on failure.

```typescript
import { createFallback } from "@openlinkos/ai";

const model = createFallback([
  createModel("openai:gpt-4o"),
  createModel("anthropic:claude-3.5-sonnet"),
  createModel("google:gemini-pro"),
]);
```

## Provider Registration

Register custom providers:

```typescript
import { registerProvider, getProvider, listProviders } from "@openlinkos/ai";

registerProvider(myCustomProvider);
const provider = getProvider("my-provider");
const names = listProviders(); // ["openai", "anthropic", "google", "my-provider"]
```

## `Usage`

```typescript
interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```
