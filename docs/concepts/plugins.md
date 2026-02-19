# Plugins

Plugins extend agent capabilities with reusable, composable modules. They provide functionality like persistent memory, document retrieval, logging, and authentication without cluttering your core agent logic.

## How Plugins Work

A plugin hooks into the agent lifecycle and adds capabilities that the agent can use during its reasoning loop. Plugins can:

- **Store and retrieve data** — Persistent memory across conversations
- **Process inputs and outputs** — Transform messages before or after the model
- **Provide tools** — Inject additional tools into the agent's toolset
- **Observe execution** — Log, trace, and monitor agent behavior

## Using a Plugin

Install the plugin package and attach it to your agent:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createMemoryStore } from "@openlinkos/plugin-memory";

const model = createModel("openai:gpt-4o");

const memory = createMemoryStore({
  backend: "sqlite",
  maxEntries: 10000,
  retentionPolicy: "relevance",
});

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant with long-term memory.",
  plugins: [memory],
});
```

## Available Plugins

| Plugin | Package | Description |
|--------|---------|-------------|
| Memory | `@openlinkos/plugin-memory` | Persistent memory with vector storage and semantic retrieval |

## Creating a Plugin

Plugins implement a standard interface that lets them integrate with the agent lifecycle:

```typescript
interface Plugin {
  /** Unique name for the plugin. */
  name: string;

  /** Called when the agent starts processing a request. */
  onStart?: (context: PluginContext) => Promise<void>;

  /** Called before each model invocation. */
  onBeforeGenerate?: (messages: Message[]) => Promise<Message[]>;

  /** Called after each model response. */
  onAfterGenerate?: (response: ModelResponse) => Promise<ModelResponse>;

  /** Called when the agent finishes processing. */
  onEnd?: (context: PluginContext) => Promise<void>;

  /** Additional tools provided by this plugin. */
  tools?: ToolDefinition[];
}
```

Each hook is optional — implement only the ones your plugin needs.

## Plugin Design Principles

- **Single responsibility** — Each plugin should do one thing well
- **Stateless where possible** — Prefer injecting state through configuration
- **Non-blocking** — Plugins should not significantly increase latency
- **Fail gracefully** — Plugin errors should not crash the agent
