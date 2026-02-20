# Tool-Using Agent

An agent that uses tools to search the web, perform calculations, and retrieve data.

## Code

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "research-assistant",
  model,
  systemPrompt: `You are a research assistant with access to tools.
Use the available tools to find information and perform calculations.
Always cite which tool you used to obtain your information.`,
  tools: [
    {
      name: "web_search",
      description: "Search the web for current information on a topic",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          maxResults: { type: "number", description: "Max results to return" },
        },
        required: ["query"],
      },
      execute: async ({ query, maxResults = 5 }) => {
        // Replace with a real search API call
        return {
          results: [
            { title: `Result about ${query}`, snippet: `Information about ${query}...` },
          ],
        };
      },
    },
    {
      name: "calculate",
      description: "Evaluate a mathematical expression",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "The math expression to evaluate" },
        },
        required: ["expression"],
      },
      execute: async ({ expression }) => {
        const result = Function(`"use strict"; return (${expression})`)();
        return { expression, result };
      },
    },
    {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units",
          },
        },
        required: ["city"],
      },
      execute: async ({ city, units = "celsius" }) => {
        // Replace with a real weather API call
        return {
          city,
          temperature: units === "celsius" ? 22 : 72,
          units,
          condition: "sunny",
          humidity: 45,
        };
      },
    },
  ],
  hooks: {
    onToolCall: (toolCall) => {
      console.log(`[Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
    },
    onToolResult: (toolCall, result) => {
      console.log(`[Result] ${toolCall.name} → ${result.slice(0, 100)}`);
    },
  },
});

// Run the agent
const response = await agent.run(
  "What's the weather in Tokyo? Also, what is 15% of 2480?"
);

console.log(response.text);

// Inspect tool usage
for (const step of response.steps) {
  for (const { call, result } of step.toolCalls) {
    console.log(`Used tool: ${call.name}`);
  }
}
```

## What This Demonstrates

- Defining multiple tools with different parameter schemas
- Using `enum` types in tool parameters
- Logging tool calls and results with hooks
- Inspecting the agent's tool usage from the response

## Run It

```bash
export OPENAI_API_KEY=sk-...

npx tsx tool-agent.ts
```

## Intercepting Tool Calls

You can block specific tool calls by returning `false` from the `onToolCall` hook:

```typescript
const agent = createAgent({
  name: "safe-agent",
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [webSearch, calculate, getWeather],
  hooks: {
    onToolCall: (toolCall) => {
      // Block web searches containing certain terms
      if (toolCall.name === "web_search") {
        const query = (toolCall.arguments as { query: string }).query;
        if (query.includes("sensitive-topic")) {
          console.log("[Blocked] Search query contains restricted term");
          return false;
        }
      }
    },
  },
});
```
