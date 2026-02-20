# @openlinkos/agent

Single agent engine with tools, guardrails, and reasoning loops.

## Installation

```bash
pnpm add @openlinkos/agent @openlinkos/ai
```

## Overview

`@openlinkos/agent` provides the core engine for defining and running AI agents. An agent combines a model, system prompt, tools, and guardrails into a ReAct-style reasoning loop.

## `createAgent()`

Create an agent instance.

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
});

const response = await agent.run("Hello!");
```

**Signature:**

```typescript
function createAgent(config: AgentConfig): Agent
```

## `AgentConfig`

```typescript
interface AgentConfig {
  /** Unique name identifying the agent. */
  name: string;
  /** The model instance to use for generation. */
  model: Model;
  /** System prompt defining the agent's behavior. */
  systemPrompt: string;
  /** Tools available to the agent. */
  tools?: ToolDefinition[];
  /** Maximum reasoning loop iterations. Default: 10. */
  maxIterations?: number;
  /** Lifecycle hooks for observability. */
  hooks?: AgentHooks;
  /** Timeout in milliseconds for tool executions. Default: 30000. */
  toolTimeout?: number;
  /** Input guardrails run before the first model call. */
  inputGuardrails?: InputGuardrail[];
  /** Output guardrails run before returning the final response. */
  outputGuardrails?: OutputGuardrail[];
  /** Content filters applied to the final response text. */
  contentFilters?: ContentFilter[];
}
```

## `Agent`

```typescript
interface Agent {
  readonly name: string;
  run(input: string): Promise<AgentResponse>;
}
```

## `AgentResponse`

```typescript
interface AgentResponse {
  /** The final text response. */
  text: string;
  /** All reasoning steps taken. */
  steps: AgentStep[];
  /** All tool calls made. */
  toolCalls: ToolCall[];
  /** Aggregated token usage. */
  usage: Usage;
  /** The agent's name. */
  agentName: string;
}
```

## `AgentStep`

```typescript
interface AgentStep {
  stepNumber: number;
  modelResponse: ModelResponse;
  toolCalls: Array<{
    call: ToolCall;
    result: string;
    error?: string;
  }>;
}
```

## Tools

### `ToolDefinition`

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}
```

### `ToolRegistry`

Manage tools programmatically:

```typescript
import { ToolRegistry } from "@openlinkos/agent";

const registry = new ToolRegistry();

registry.register({
  name: "greet",
  description: "Greet a user by name",
  parameters: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  },
  execute: async ({ name }) => `Hello, ${name}!`,
});

const tools = registry.all();
```

### `validateParameters()`

Validate parameters against a JSON Schema:

```typescript
import { validateParameters } from "@openlinkos/agent";

const result = validateParameters(schema, params);
if (!result.valid) {
  console.error(result.errors);
}
```

### `executeTool()`

Execute a tool with parameter validation:

```typescript
import { executeTool } from "@openlinkos/agent";

const result = await executeTool(tool, { name: "Alice" });
```

## Hooks

### `AgentHooks`

```typescript
interface AgentHooks {
  /** Called when the agent starts processing. */
  onStart?: (input: string) => void | Promise<void>;
  /** Called before a tool executes. Return false to block. */
  onToolCall?: (toolCall: ToolCall) => void | boolean | Promise<void | boolean>;
  /** Called after a tool produces a result. */
  onToolResult?: (toolCall: ToolCall, result: string) => void | Promise<void>;
  /** Called after each reasoning step. */
  onStep?: (step: AgentStep) => void | Promise<void>;
  /** Called when the agent finishes. */
  onEnd?: (response: AgentResponse) => void | Promise<void>;
  /** Called when an error occurs. */
  onError?: (error: Error) => void | Promise<void>;
}
```

## Guardrails

### Input Guardrails

Run before the first model call. Can block or modify input:

```typescript
import { runInputGuardrails, maxLengthGuardrail } from "@openlinkos/agent";

const agent = createAgent({
  name: "safe-agent",
  model,
  systemPrompt: "You are a helpful assistant.",
  inputGuardrails: [maxLengthGuardrail(1000)],
});
```

### Output Guardrails

Run before returning the final response:

```typescript
const agent = createAgent({
  name: "quality-agent",
  model,
  systemPrompt: "You are a helpful assistant.",
  outputGuardrails: [
    {
      name: "no-empty-response",
      validate: async (output) => ({
        passed: output.length > 0,
        message: "Response must not be empty",
      }),
    },
  ],
});
```

### Content Filters

Post-processing text transformations:

```typescript
import { regexBlockFilter } from "@openlinkos/agent";

const agent = createAgent({
  name: "filtered-agent",
  model,
  systemPrompt: "You are a helpful assistant.",
  contentFilters: [regexBlockFilter(/badword/gi, "[redacted]")],
});
```

### `GuardrailResult`

```typescript
interface GuardrailResult {
  passed: boolean;
  message?: string;
}
```
