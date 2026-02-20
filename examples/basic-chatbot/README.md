# Basic Chatbot

A simple chatbot agent with a calculator tool, powered by a mock LLM provider.

## What it demonstrates

- Registering a custom (mock) model provider
- Creating a model with `createModel()`
- Defining an agent with `createAgent()` including tools and lifecycle hooks
- Running a multi-turn conversation with tool calling

## Run

```bash
npx tsx chatbot.ts
```

## Key concepts

- **Mock provider**: A simple provider that returns canned responses and triggers tool calls when it detects math-related questions.
- **Calculator tool**: A tool that evaluates math expressions, demonstrating the agent's tool-calling loop.
- **Lifecycle hooks**: `onStart`, `onToolCall`, and `onEnd` hooks log each step of the agent's reasoning.
