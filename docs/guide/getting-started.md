# Getting Started

This guide walks you through setting up your development environment and creating your first OpenLinkOS agent.

## Prerequisites

- **Node.js** 18 or later
- **pnpm** 9 or later

## Installation

Install the core packages:

```bash
pnpm add @openlinkos/ai @openlinkos/agent
```

## Create a Model

The `@openlinkos/ai` package provides a unified interface to LLM providers. Create a model instance by specifying a `provider:model` identifier:

```typescript
import { createModel } from "@openlinkos/ai";

// OpenAI
const openai = createModel("openai:gpt-4o");

// Anthropic
const claude = createModel("anthropic:claude-3.5-sonnet");

// Google Gemini
const gemini = createModel("google:gemini-pro");

// Ollama (local models)
const local = createModel("ollama:llama3");
```

Set your API key via environment variables:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
```

## Create Your First Agent

An agent combines a model with a system prompt and optional tools:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant that answers questions concisely.",
});

const response = await agent.run("What is TypeScript?");
console.log(response.text);
```

## Add Tools

Tools let agents interact with the outside world. Define a tool with a name, description, JSON Schema parameters, and an execute function:

```typescript
const agent = createAgent({
  name: "weather-agent",
  model,
  systemPrompt: "You help users check the weather.",
  tools: [
    {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "The city name" },
        },
        required: ["city"],
      },
      execute: async ({ city }) => {
        // Replace with a real API call
        return { temperature: 22, condition: "sunny", city };
      },
    },
  ],
});

const response = await agent.run("What's the weather in Tokyo?");
```

## Build a Team

For complex tasks, orchestrate multiple agents using `@openlinkos/team`:

```bash
pnpm add @openlinkos/team
```

```typescript
import { createTeam } from "@openlinkos/team";

const researcher = createAgent({
  name: "researcher",
  model,
  systemPrompt: "You research topics thoroughly and report findings.",
});

const writer = createAgent({
  name: "writer",
  model,
  systemPrompt: "You write clear, engaging content based on research.",
});

const team = createTeam({
  mode: "pipeline",
  agents: [researcher, writer],
});

const result = await team.run("Write an article about quantum computing.");
console.log(result.text);
```

## Next Steps

- Learn about [Plugins](/concepts/plugins) to extend agent capabilities
- Understand [Sub-agents](/concepts/subagents) for task delegation
- Explore [Teams](/concepts/teams) for multi-agent collaboration
- Read about [Skills](/concepts/skills) for reusable agent behaviors
