# Your First Agent

This guide walks you through creating, configuring, and running your first OpenLinkOS agent.

## Create a Model

Every agent needs a model. The `@openlinkos/ai` package provides a unified interface across providers. Create a model by specifying a `provider:model` identifier:

```typescript
import { createModel } from "@openlinkos/ai";

// OpenAI
const gpt4o = createModel("openai:gpt-4o");

// Anthropic
const claude = createModel("anthropic:claude-3.5-sonnet");

// Google Gemini
const gemini = createModel("google:gemini-pro");

// Ollama (local models)
const local = createModel("ollama:llama3");
```

You can also pass configuration options:

```typescript
const model = createModel("openai:gpt-4o", {
  temperature: 0.7,
  maxTokens: 1024,
});
```

## Create an Agent

An agent combines a model with a system prompt. The system prompt defines the agent's personality and capabilities:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant that answers questions concisely.",
});
```

## Run the Agent

Call `agent.run()` with a user message to get a response:

```typescript
const response = await agent.run("What is TypeScript?");
console.log(response.text);
// TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.
```

## Inspect the Response

The `AgentResponse` object contains the full execution trace:

```typescript
const response = await agent.run("Explain closures in JavaScript.");

// The text output
console.log(response.text);

// Token usage
console.log(`Tokens used: ${response.usage.totalTokens}`);

// Number of reasoning steps
console.log(`Steps: ${response.steps.length}`);

// Agent name
console.log(`Agent: ${response.agentName}`);
```

## Add Lifecycle Hooks

Hooks let you observe and control the agent's execution. They are useful for logging, debugging, and building UIs:

```typescript
const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
  hooks: {
    onStart: (input) => {
      console.log(`Processing: ${input}`);
    },
    onStep: (step) => {
      console.log(`Step ${step.stepNumber}: ${step.toolCalls.length} tool calls`);
    },
    onEnd: (response) => {
      console.log(`Done. Used ${response.usage.totalTokens} tokens.`);
    },
    onError: (error) => {
      console.error(`Error: ${error.message}`);
    },
  },
});
```

## Control Iterations

By default, an agent runs up to 10 reasoning loop iterations. You can adjust this:

```typescript
const agent = createAgent({
  name: "researcher",
  model,
  systemPrompt: "You are a thorough researcher.",
  maxIterations: 20, // Allow more reasoning steps
});
```

## Full Example

Here's a complete runnable example:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "code-reviewer",
  model,
  systemPrompt: `You are a senior code reviewer. When given code, you:
1. Identify bugs and issues
2. Suggest improvements
3. Rate the code quality from 1-10`,
  maxIterations: 5,
  hooks: {
    onStart: (input) => console.log("Reviewing code..."),
    onEnd: (response) => console.log(`Review complete (${response.usage.totalTokens} tokens)`),
  },
});

const response = await agent.run(`
Review this function:
function add(a, b) {
  return a + b;
}
`);

console.log(response.text);
```

## Next Steps

- [Add tools](/guide/tools) to let your agent interact with external systems
- [Build a team](/guide/teams) to orchestrate multiple agents
- See the full [Agent API reference](/api/agent)
