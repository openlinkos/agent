# 03 - Tool Calling

An agent equipped with a **calculator** and a **weather** tool. Shows how the agent reasons about which tools to use and chains them together.

## What it demonstrates

- Defining tools with `ToolDefinition` (name, description, JSON Schema parameters, execute)
- Passing tools to `createAgent`
- The ReAct reasoning loop: think → call tool → observe → repeat → answer
- `onToolCall` and `onEnd` lifecycle hooks

## Prerequisites

- An OpenAI-compatible API key (tool calling required: GPT-4o, GPT-4o-mini, etc.)
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/03-tool-calling/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model (must support tool calling) |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |

## Expected Output

```
=== 03 - Tool Calling ===

> What is 1337 * 42?
  [calling calculate]
  [calculator] 1337 * 42 = 56154

🤖  1337 × 42 = 56,154
  [38 tokens]

> What's the weather like in Tokyo and London right now?
  [calling get_weather]
  [weather] Tokyo: 28°C, Sunny
  [calling get_weather]
  [weather] London: 15°C, Overcast

🤖  Tokyo is sunny at 28°C, while London is overcast at 15°C.
  [72 tokens]
```
