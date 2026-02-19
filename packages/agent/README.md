# @openlinkos/agent

Single agent engine — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/agent` provides the core engine for defining and running AI agents. An agent combines a model, system prompt, tools, and guardrails into a coherent reasoning loop that can solve tasks autonomously.

## Installation

```bash
pnpm add @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
      execute: async ({ location }) => {
        return { temperature: 22, condition: "sunny", location };
      },
    },
  ],
});

const response = await agent.run("What's the weather in Tokyo?");
console.log(response.text);
```

## Features

- **ReAct reasoning loop** — Think, act, observe, repeat until the task is solved
- **Tool execution** — Define tools with schemas and handlers; the agent calls them automatically
- **Guardrails** — Input/output validators to enforce safety and quality constraints
- **Lifecycle hooks** — Tap into onStart, onToolCall, onResponse, onError, and onEnd events
- **Memory management** — Sliding window and summarization strategies for long conversations
- **Streaming** — Token-by-token response streaming
- **Tracing** — Full execution trace for debugging and observability

## License

[MIT](../../LICENSE)
