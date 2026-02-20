# Overview

OpenLinkOS is an open-source TypeScript framework for building, orchestrating, and deploying AI agents. It provides a layered architecture — from a unified model layer up to multi-agent teams — so you can start simple and scale up as needed.

## Architecture

```
┌─────────────────────────────────────────────┐
│               @openlinkos/team              │  Multi-agent collaboration
├──────────────────────┬──────────────────────┤
│  @openlinkos/subagent│   @openlinkos/mcp    │  Delegation & tool protocol
├──────────────────────┴──────────────────────┤
│              @openlinkos/agent              │  Single agent engine
├─────────────────────────────────────────────┤
│               @openlinkos/ai               │  Unified model layer
└─────────────────────────────────────────────┘
```

**@openlinkos/ai** — Provider-agnostic model interface supporting OpenAI, Anthropic, Google Gemini, and Ollama.

**@openlinkos/agent** — Agent engine with ReAct-style reasoning, tool execution, guardrails, and lifecycle hooks.

**@openlinkos/team** — Multi-agent collaboration with supervisor, sequential, parallel, debate, and custom modes.

**@openlinkos/subagent** — Sub-agent spawning with scoped context and parallel delegation.

**@openlinkos/mcp** — Model Context Protocol client for connecting to external tool servers.

**@openlinkos/eval** — Evaluation framework with built-in scorers and test suites.

**Channels** — Deploy agents to terminal, web, Telegram, Discord, Slack, and more.

**Plugins** — Extend agents with persistent memory, retrieval, and custom lifecycle hooks.

## Installation

::: code-group

```bash [pnpm]
pnpm add @openlinkos/ai @openlinkos/agent
```

```bash [npm]
npm install @openlinkos/ai @openlinkos/agent
```

```bash [yarn]
yarn add @openlinkos/ai @openlinkos/agent
```

:::

## Prerequisites

- **Node.js** 18 or later
- **pnpm** 9+ (recommended), npm, or yarn
- An API key from at least one LLM provider (OpenAI, Anthropic, or Google)

## Environment Setup

Set your provider API key as an environment variable:

```bash
# Pick one (or more) depending on your provider
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...
```

## Quick Start

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
});

const response = await agent.run("What is TypeScript?");
console.log(response.text);
```

## Packages

| Package | Description |
|---------|-------------|
| `@openlinkos/ai` | Unified model layer for LLM providers |
| `@openlinkos/agent` | Single agent engine with tools and guardrails |
| `@openlinkos/team` | Multi-agent team collaboration |
| `@openlinkos/subagent` | Sub-agent spawning and delegation |
| `@openlinkos/mcp` | Model Context Protocol client/server |
| `@openlinkos/eval` | Agent evaluation and testing |
| `@openlinkos/cli` | Command-line tool for running agents |
| `@openlinkos/channel` | Core channel abstraction |
| `@openlinkos/channel-terminal` | Terminal I/O channel |
| `@openlinkos/channel-web` | HTTP/WebSocket channel |
| `@openlinkos/plugin-memory` | Persistent memory plugin |

## Next Steps

- [Create your first agent](/guide/first-agent) — Build and run a simple agent
- [Add tools](/guide/tools) — Give your agent the ability to take actions
- [Build a team](/guide/teams) — Orchestrate multiple agents
- [Use the CLI](/guide/cli) — Run agents from the command line
