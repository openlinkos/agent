<p align="center">
  <strong>OpenLinkOS Agent Framework</strong><br/>
  A comprehensive TypeScript agent framework for building AI-powered applications.
</p>

<p align="center">
  <a href="https://github.com/openlinkos/agent/actions/workflows/ci.yml"><img src="https://github.com/openlinkos/agent/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/openlinkos/agent"><img src="https://img.shields.io/badge/tests-970%2B%20passing-brightgreen" alt="Tests: 970+ passing" /></a>
</p>

---

## Quick Start

```bash
pnpm add @openlinkos/ai @openlinkos/agent
```

```typescript
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

// 1. Register one or more providers
registerProvider(createOpenAIProvider());

// 2. Create a model (provider:model format)
const model = createModel("openai:gpt-4o", {
  apiKey: process.env.OPENAI_API_KEY,
});

// 3. Create an agent and run it
const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
});

const { text } = await agent.run("What is the capital of France?");
console.log(text);
```

## Providers

### Built-in providers

| Provider | Model ID prefix | Adapter |
|----------|-----------------|---------|
| OpenAI | `openai:gpt-4o`, `openai:gpt-4o-mini` | OpenAI |
| Anthropic | `anthropic:claude-sonnet-4-20250514` | Anthropic |
| Google Gemini | `google:gemini-2.0-flash` | Native |
| DeepSeek | `deepseek:deepseek-chat` | OpenAI |
| Qwen | `qwen:qwen-turbo` | OpenAI |
| Ollama | `ollama:llama3` | OpenAI |

All providers share a unified interface — swap models by changing a single string.

### Provider architecture

Providers are built on two adapter base classes:

- **`OpenAIAdapter`** — For any API that follows the OpenAI Chat Completions format. Used by OpenAI, DeepSeek, Qwen, and Ollama out of the box.
- **`AnthropicAdapter`** — For any API that follows the Anthropic Messages format. Used by Anthropic out of the box.

This means **any OpenAI-compatible or Anthropic-compatible endpoint** works with the framework — just point `baseURL` at your service.

### Model configuration

`createModel()` accepts a second config parameter:

```typescript
const model = createModel("openai:gpt-4o", {
  apiKey: process.env.OPENAI_API_KEY,  // API key (defaults to provider env var)
  baseURL: "https://your-api.com/v1",  // Custom endpoint URL
  temperature: 0.7,                     // Sampling temperature (0–2)
  maxTokens: 4096,                      // Maximum tokens to generate
  topP: 0.9,                            // Top-p sampling
  stop: ["\n"],                         // Stop sequences
});
```

Config can also be overridden per call:

```typescript
await model.generate(messages, { temperature: 0 });
```

Each provider reads its API key from an environment variable by default:

| Provider | Env var |
|----------|---------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Qwen | `DASHSCOPE_API_KEY` |
| Ollama | _(none required)_ |

### Custom / compatible endpoints

Any OpenAI-compatible or Anthropic-compatible service can be used by setting `baseURL`:

```typescript
import {
  registerProvider,
  createOpenAIProvider,
  createAnthropicProvider,
  createModel,
} from "@openlinkos/ai";

// OpenAI-compatible endpoint (Azure, LiteLLM, vLLM, etc.)
registerProvider(createOpenAIProvider());
const model = createModel("openai:my-model", {
  baseURL: "https://my-openai-compatible-api.com/v1",
  apiKey: "...",
});

// Anthropic-compatible endpoint
registerProvider(createAnthropicProvider());
const model2 = createModel("anthropic:claude-sonnet-4-20250514", {
  baseURL: "https://my-anthropic-compatible-api.com",
  apiKey: "...",
});
```

## Packages

| Package | Description |
|---------|-------------|
| [`@openlinkos/ai`](./packages/ai) | Unified model layer — streaming, tool calling, structured output, retry, fallback |
| [`@openlinkos/agent`](./packages/agent) | Single agent engine — ReAct loop, tools, guardrails, lifecycle hooks |
| [`@openlinkos/subagent`](./packages/subagent) | Child agent spawning — delegation, scoping, parallel execution |
| [`@openlinkos/team`](./packages/team) | Multi-agent teams — supervisor, sequential, parallel, debate coordination |
| [`@openlinkos/mcp`](./packages/mcp) | Model Context Protocol — connect to any MCP tool server |
| [`@openlinkos/eval`](./packages/eval) | Agent evaluation — scorers, reporters, built-in test suites |
| [`@openlinkos/channel`](./packages/channel) | Channel abstraction — unified message I/O for any platform |
| [`@openlinkos/plugin-memory`](./plugins/plugin-memory) | Memory plugin — conversation history, key-value store, vector retrieval |
| [`@openlinkos/cli`](./packages/cli) | CLI — scaffold projects, run agents, manage teams |

Channel adapters: [Telegram](./channels/channel-telegram) · [Discord](./channels/channel-discord) · [Slack](./channels/channel-slack) · [Feishu](./channels/channel-feishu) · [DingTalk](./channels/channel-dingtalk)

## Key Features

**ReAct Agent Loop** — Agents reason and act in a loop, calling tools and refining responses until the task is complete. Built-in guardrails (input/output validation, content filters) and lifecycle hooks for full control.

**Multi-Agent Teams** — Orchestrate agents with four coordination patterns:
- **Supervisor** — A lead agent delegates tasks, reviews results, and synthesizes a final output
- **Sequential** — Agents process in order, each building on the previous output
- **Parallel** — All agents work simultaneously; results are aggregated
- **Debate** — Agents argue opposing sides; a judge resolves conflicts

**Workflow Engine** — Define deterministic multi-step workflows with branching, loops, and parallel execution.

**Structured Output** — Request JSON responses conforming to a schema. Validated at the framework level.

**Agent-as-Tool** — Expose any agent as a tool that other agents can call, enabling deep composition.

**Middleware & Plugins** — Hook into the agent lifecycle with composable middleware. The memory plugin provides conversation history, persistent key-value storage, and semantic vector retrieval out of the box.

**Observability** — Every agent step is traced with token usage, latency, and tool call details. Plug in custom reporters for logging, metrics, or debugging.

**Rate Limiting** — Built-in rate limiter with configurable token and request quotas per time window.

**MCP Integration** — First-class Model Context Protocol support. Connect to any MCP-compatible tool server, or bridge MCP tools into your agents.

**Evals** — Evaluate agent quality with exact-match, inclusion, tool-call, and LLM-judge scorers. Generate reports in console or JSON format.

## Comparison

| | OpenLinkOS Agent | Vercel AI SDK | LangChain | Claude Agent SDK |
|---|---|---|---|---|
| Multi-agent teams | Supervisor, debate, sequential, parallel | No | Limited (LangGraph) | No |
| Agent loop | ReAct (built-in) | Yes (agent loop) | Yes (LangGraph) | Yes (Claude-native) |
| Agent-as-tool composition | Yes | No | Partial | No |
| Built-in MCP support | Client + bridge | Yes | Community | Native |
| Structured output | Schema-validated | Yes | Yes | Yes |
| Channel adapters | Telegram, Discord, Slack, Feishu, DingTalk | No | No | No |
| Eval framework | Built-in scorers + reporters | No | LangSmith (separate) | No |
| Memory | Conversation + KV + vector | No | Yes | No |
| Provider support | OpenAI, Anthropic, Google, DeepSeek, Qwen, Ollama + any compatible endpoint | OpenAI, Anthropic, Google, more | Broad | Anthropic only |
| Streaming | Yes | Yes | Yes | Yes |
| TypeScript-first | Yes | Yes | Python-first | Python-first |
| License | MIT | Apache 2.0 | MIT | MIT |

## Architecture

```mermaid
graph TD
    CLI["@openlinkos/cli"]
    TEAM["@openlinkos/team<br/><small>supervisor · sequential · parallel · debate</small>"]
    EVAL["@openlinkos/eval<br/><small>scorers · reporters</small>"]
    SUBAGENT["@openlinkos/subagent<br/><small>spawn · delegate · progress</small>"]
    AGENT["@openlinkos/agent<br/><small>ReAct loop · tools · guardrails</small>"]
    MCP["@openlinkos/mcp<br/><small>client · bridge</small>"]
    MEMORY["@openlinkos/plugin-memory<br/><small>conversation · KV · vector</small>"]
    AI["@openlinkos/ai<br/><small>OpenAI · Anthropic · Google · DeepSeek · Qwen · Ollama</small>"]
    CHANNEL["@openlinkos/channel<br/><small>base · manager</small>"]
    ADAPTERS["Channel Adapters<br/><small>Telegram · Discord · Slack · Feishu · DingTalk</small>"]

    CLI --> TEAM
    CLI --> AGENT
    TEAM --> SUBAGENT
    TEAM --> AGENT
    EVAL --> AGENT
    SUBAGENT --> AGENT
    MCP --> AGENT
    MEMORY --> AGENT
    AGENT --> AI
    ADAPTERS --> CHANNEL
```

## Examples

```bash
cd examples/basic-chatbot && npx tsx chatbot.ts
```

| Example | What it shows |
|---------|---------------|
| [`basic-chatbot`](./examples/basic-chatbot) | Agent with tools and multi-turn conversation |
| [`multi-agent-debate`](./examples/multi-agent-debate) | Two agents debating with a judge |
| [`supervisor-team`](./examples/supervisor-team) | Supervisor delegating to specialized workers |
| [`mcp-tools`](./examples/mcp-tools) | Agent using MCP tools via stdio bridge |

## Development

```bash
git clone https://github.com/openlinkos/agent.git && cd agent
pnpm install
pnpm build
pnpm test        # 970+ tests
pnpm typecheck
pnpm lint
```

## Contributing

Contributions welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) — Copyright (c) 2026 OpenLinkOS contributors
