# OpenLinkOS Agent Framework

An open-source framework for building, orchestrating, and deploying AI agents — from single agents to collaborative multi-agent teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/stars/openlinkos/agent?style=social)](https://github.com/openlinkos/agent)

## Vision

OpenLinkOS provides a modular, production-ready Agent framework that covers the full spectrum of AI agent development — from low-level model invocation through single-agent orchestration to advanced multi-agent collaboration patterns. The framework is designed to be incrementally adoptable: use only what you need, and scale up as your requirements grow.

## Core Features

- **Unified Model Layer** — A single abstraction over multiple LLM providers (OpenAI, Anthropic, Google, and more), with built-in tool calling, structured output, and streaming support.
- **Single Agent Engine** — Define agents with system prompts, tools, guardrails, and lifecycle hooks. Supports ReAct-style reasoning loops with full observability.
- **Sub-agent Specialization** — Spawn, delegate to, and compose child agents with scoped capabilities. Manage context windows and handoff strategies.
- **Multi-Agent Teams** — The framework's core differentiator. Orchestrate groups of agents using built-in collaboration patterns:
  - **Supervisor** — A lead agent delegates tasks, reviews results, and synthesizes outputs.
  - **Swarm** — Agents self-organize, claim tasks, and converge on solutions.
  - **Pipeline** — Sequential processing where each agent transforms and passes data forward.
  - **Debate** — Agents argue opposing perspectives, with a judge agent resolving conflicts.
- **MCP Tool Protocol** — First-class support for the Model Context Protocol. Connect to any MCP-compatible tool server, or expose your agents as MCP tool providers.
- **Channel Integrations** — Deploy agents to messaging platforms (Telegram, Feishu, Discord, Slack, DingTalk) with a unified channel abstraction.
- **Plugin System** — Extend agent capabilities with composable plugins for memory, retrieval, logging, and more.
- **CLI** — Scaffold projects, run agents locally, and manage deployments from the command line.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    @openlinkos/cli                       │
├─────────────────────────────────────────────────────────┤
│  @openlinkos/team    │  @openlinkos/eval                │
│  (supervisor, debate,│  (scorers, reporters,             │
│   pipeline, parallel)│   test suites)                    │
├──────────────────────┼──────────────────────────────────┤
│  @openlinkos/agent   │  @openlinkos/subagent            │
│  (tools, guardrails, │  (spawn, delegate,                │
│   ReAct loop, hooks) │   progress tracking)              │
├──────────────────────┴──────────────────────────────────┤
│  @openlinkos/ai                                         │
│  (OpenAI, Anthropic, Google — streaming, retry, tools)  │
├─────────────────────────────────────────────────────────┤
│  @openlinkos/mcp     │  @openlinkos/channel             │
│  (MCP client/bridge) │  (terminal, web, Slack, ...)     │
└─────────────────────────────────────────────────────────┘
```

## Package Structure

| Package | Description |
|---------|-------------|
| [`@openlinkos/ai`](./packages/ai) | Model invocation layer — unified interface to LLM providers |
| [`@openlinkos/agent`](./packages/agent) | Single agent engine — tools, prompts, guardrails, loops |
| [`@openlinkos/subagent`](./packages/subagent) | Sub-agent management — delegation, scoping, handoff |
| [`@openlinkos/team`](./packages/team) | Multi-agent collaboration — supervisor, swarm, pipeline, debate |
| [`@openlinkos/mcp`](./packages/mcp) | MCP tool protocol — client and bridge |
| [`@openlinkos/eval`](./packages/eval) | Agent evaluation — scorers, reporters, test suites |
| [`@openlinkos/channel`](./packages/channel) | Core channel interface for unified message I/O |
| [`@openlinkos/channel-terminal`](./packages/channel-terminal) | Terminal/stdin channel adapter |
| [`@openlinkos/channel-web`](./packages/channel-web) | HTTP/WebSocket/SSE channel adapter |
| [`@openlinkos/cli`](./cli/cli) | Command-line interface — project scaffolding and local dev |
| [`@openlinkos/channel-telegram`](./channels/channel-telegram) | Telegram bot channel adapter |
| [`@openlinkos/channel-feishu`](./channels/channel-feishu) | Feishu (Lark) bot channel adapter |
| [`@openlinkos/channel-discord`](./channels/channel-discord) | Discord bot channel adapter |
| [`@openlinkos/channel-slack`](./channels/channel-slack) | Slack bot channel adapter |
| [`@openlinkos/channel-dingtalk`](./channels/channel-dingtalk) | DingTalk bot channel adapter |
| [`@openlinkos/plugin-memory`](./plugins/plugin-memory) | Persistent memory plugin for agents |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/openlinkos/agent.git
cd agent

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Create Your First Agent

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [],
});

const response = await agent.run("Hello, what can you do?");
console.log(response.text);
```

### Build a Multi-Agent Team

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam } from "@openlinkos/team";

const model = createModel("openai:gpt-4o");

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
  name: "content-team",
  coordinationMode: "sequential",
  agents: [researcher, writer],
});

const result = await team.run("Write an article about quantum computing.");
console.log(result.finalOutput);
```

## Examples

Runnable examples are in the [`examples/`](./examples) directory:

| Example | Description |
|---------|-------------|
| [`basic-chatbot`](./examples/basic-chatbot) | Agent with a calculator tool and mock provider |
| [`multi-agent-debate`](./examples/multi-agent-debate) | Two agents debating with a judge |
| [`supervisor-team`](./examples/supervisor-team) | Supervisor delegating to workers |
| [`mcp-tools`](./examples/mcp-tools) | Agent using MCP tools via bridge |

Run any example with:

```bash
cd examples/basic-chatbot
npx tsx chatbot.ts
```

## Documentation

Visit [openlinkos.com](https://openlinkos.com) for the full documentation, including guides, API references, and examples.

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Start docs dev server
pnpm docs:dev
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the phased development plan.

## Contributing

We welcome contributions of all kinds. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to get involved.

## License

[MIT](./LICENSE) — Copyright (c) 2026 OpenLinkOS contributors
