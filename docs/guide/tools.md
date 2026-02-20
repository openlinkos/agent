# Adding Tools

Tools let agents interact with the outside world — call APIs, query databases, read files, or perform calculations. An agent decides when and how to use its tools as part of its reasoning loop.

## Define a Tool

A tool has four parts: a name, a description (used by the model to understand when to call it), a JSON Schema for parameters, and an `execute` function:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

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
        const res = await fetch(`https://api.weather.example/v1?city=${city}`);
        return res.json();
      },
    },
  ],
});

const response = await agent.run("What's the weather in Tokyo?");
console.log(response.text);
```

## Multiple Tools

Agents can use multiple tools in a single run. The model chooses which tools to call based on the task:

```typescript
const agent = createAgent({
  name: "research-agent",
  model,
  systemPrompt: "You are a research assistant with access to search and calculation tools.",
  tools: [
    {
      name: "web_search",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
      execute: async ({ query }) => {
        return { results: [`Result for: ${query}`] };
      },
    },
    {
      name: "calculate",
      description: "Evaluate a mathematical expression",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Math expression to evaluate" },
        },
        required: ["expression"],
      },
      execute: async ({ expression }) => {
        return { result: eval(expression) };
      },
    },
  ],
});
```

## Tool Parameter Schemas

Parameters are defined using JSON Schema. This schema is sent to the model so it knows what arguments to provide:

```typescript
{
  name: "create_event",
  description: "Create a calendar event",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      date: { type: "string", description: "ISO 8601 date string" },
      duration: { type: "number", description: "Duration in minutes" },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "List of attendee email addresses",
      },
    },
    required: ["title", "date"],
  },
  execute: async (params) => {
    // Create the event...
    return { eventId: "evt_123", status: "created" };
  },
}
```

## Intercept Tool Calls

Use the `onToolCall` hook to log, modify, or block tool calls. Return `false` to prevent execution:

```typescript
const agent = createAgent({
  name: "safe-agent",
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [myTool],
  hooks: {
    onToolCall: (toolCall) => {
      console.log(`Tool called: ${toolCall.name}`, toolCall.arguments);
      // Return false to block this call
      if (toolCall.name === "dangerous_action") {
        return false;
      }
    },
    onToolResult: (toolCall, result) => {
      console.log(`${toolCall.name} returned: ${result}`);
    },
  },
});
```

## Tool Timeouts

By default, each tool execution has a 30-second timeout. You can adjust this per agent:

```typescript
const agent = createAgent({
  name: "slow-tools-agent",
  model,
  systemPrompt: "You use tools that may take a while.",
  tools: [longRunningTool],
  toolTimeout: 60000, // 60 seconds
});
```

## Using the Tool Registry

For programmatic tool management, use the `ToolRegistry` class:

```typescript
import { ToolRegistry } from "@openlinkos/agent";

const registry = new ToolRegistry();

registry.register({
  name: "greet",
  description: "Greet a user",
  parameters: {
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
  },
  execute: async ({ name }) => `Hello, ${name}!`,
});

// Use registry tools in an agent
const agent = createAgent({
  name: "greeter",
  model,
  systemPrompt: "You greet people.",
  tools: registry.getAll(),
});
```

## MCP Tools

You can also connect to external tool servers using the Model Context Protocol. See the [MCP guide](/api/mcp) for details.

```typescript
import { createMCPClient, createMCPTools } from "@openlinkos/mcp";

const client = createMCPClient({
  server: "npx @modelcontextprotocol/server-filesystem",
  transport: "stdio",
});

await client.connect();
const tools = createMCPTools(client);

const agent = createAgent({
  name: "file-agent",
  model,
  systemPrompt: "You help with file operations.",
  tools,
});
```

## Next Steps

- [Build a team](/guide/teams) of tool-using agents
- See the full [Agent API reference](/api/agent)
- Explore the [Tool-Using Agent example](/examples/tool-agent)
