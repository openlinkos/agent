# Basic Chatbot

A simple chatbot agent that responds to user messages with a terminal interface.

## Code

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { TerminalChannel } from "@openlinkos/channel-terminal";

// 1. Create a model
const model = createModel("openai:gpt-4o");

// 2. Create an agent with a personality
const agent = createAgent({
  name: "chatbot",
  model,
  systemPrompt: `You are a friendly, helpful chatbot. You:
- Answer questions clearly and concisely
- Ask follow-up questions when the user's intent is unclear
- Maintain a warm, conversational tone`,
  maxIterations: 5,
  hooks: {
    onStart: (input) => console.log(`\n[Processing: "${input.slice(0, 50)}..."]\n`),
    onEnd: (response) => {
      console.log(`[Tokens: ${response.usage.totalTokens}]\n`);
    },
  },
});

// 3. Connect to a terminal channel
const channel = new TerminalChannel({
  prompt: "You> ",
  agentName: "Chatbot",
});

channel.on("message", async (message) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await channel.connect();
```

## What This Demonstrates

- Creating a model with `createModel()`
- Defining an agent with a system prompt
- Using lifecycle hooks for logging
- Connecting an agent to a terminal channel for interactive chat

## Run It

```bash
export OPENAI_API_KEY=sk-...

npx tsx chatbot.ts
```

Type messages at the prompt and the chatbot will respond. Press `Ctrl+C` to exit.

## Variations

### With a Web Interface

Replace `TerminalChannel` with `WebChannel` to expose the chatbot over HTTP:

```typescript
import { WebChannel } from "@openlinkos/channel-web";

const channel = new WebChannel({ port: 3000, cors: true });

channel.on("message", async (message) => {
  const response = await agent.run(message.content);
  await channel.send({ role: "assistant", content: response.text });
});

await channel.connect();
// POST http://localhost:3000/message with { "content": "Hello!" }
```

### With Memory

Add persistent memory so the chatbot remembers across sessions:

```typescript
import { createMemoryPlugin } from "@openlinkos/plugin-memory";

const memory = createMemoryPlugin({
  conversation: { maxMessages: 100 },
  persistent: { filePath: "./chatbot-memory.json" },
});

const agent = createAgent({
  name: "chatbot",
  model,
  systemPrompt: "You are a friendly chatbot with persistent memory.",
  tools: memory.tools,
  hooks: memory.hooks,
});
```
