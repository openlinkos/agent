# OpenLinkOS Roadmap

This document outlines the phased development plan for the OpenLinkOS Agent Framework. Each phase builds on the previous one, progressively unlocking more powerful agent capabilities.

---

## Phase 1: Foundation — `@openlinkos/ai` + `@openlinkos/agent`

**Goal:** Establish the core model invocation layer and single-agent engine.

### @openlinkos/ai
- Unified model interface supporting OpenAI, Anthropic, Google Gemini, and open-source models (via Ollama)
- Streaming and non-streaming completions
- Tool calling with automatic schema generation from TypeScript types
- Structured output with Zod schema validation
- Token usage tracking and cost estimation
- Retry and fallback strategies
- Provider-specific configuration passthrough

### @openlinkos/agent
- Agent definition with system prompts, tools, and configuration
- ReAct-style reasoning loop with configurable max iterations
- Tool execution with input validation and error handling
- Guardrails — input/output validators that can block, modify, or flag messages
- Lifecycle hooks (onStart, onToolCall, onResponse, onError, onEnd)
- Conversation memory management (sliding window, summarization)
- Streaming response support
- Full execution tracing for observability

---

## Phase 2: Composition — `@openlinkos/subagent` + `@openlinkos/mcp`

**Goal:** Enable agent delegation and external tool connectivity.

### @openlinkos/subagent
- Spawn child agents with scoped capabilities and context
- Parent-to-child delegation with task descriptions and constraints
- Context window management — selective context passing, summarization before handoff
- Result aggregation from multiple sub-agents
- Parallel and sequential sub-agent execution
- Error propagation and recovery strategies
- Sub-agent lifecycle management (timeout, cancellation)

### @openlinkos/mcp
- MCP client — connect to any MCP-compatible tool server
- MCP server — expose agents and tools as MCP endpoints
- Dynamic tool discovery and schema introspection
- Session management and authentication
- Transport support: stdio, HTTP/SSE, WebSocket
- Tool result caching and rate limiting

---

## Phase 3: Collaboration — `@openlinkos/team`

**Goal:** Multi-agent collaboration — the framework's primary differentiator.

### Collaboration Modes

#### Supervisor
- A lead agent receives the task, decomposes it, and delegates sub-tasks to worker agents
- The supervisor reviews worker outputs, requests revisions, and synthesizes the final result
- Configurable delegation strategies (round-robin, capability-based, load-balanced)
- Shared scratchpad for inter-agent communication

#### Swarm
- Agents self-organize around a shared task without a central coordinator
- Each agent can claim, work on, and publish results for sub-tasks
- Convergence detection — the swarm completes when agents reach consensus or exhaust the task space
- Configurable communication topology (broadcast, peer-to-peer, ring)

#### Pipeline
- Sequential processing where each agent transforms the input and passes it forward
- Stage-level configuration (retry, skip, branch)
- Conditional routing — dynamically choose the next stage based on intermediate results
- Parallel fan-out and fan-in for stages that can run concurrently

#### Debate
- Two or more agents argue opposing perspectives on a topic
- A judge agent evaluates arguments and produces a final ruling
- Configurable number of debate rounds
- Structured argument format with claims, evidence, and rebuttals
- Useful for decision-making, red-teaming, and adversarial evaluation

### Cross-cutting Features
- Team-level observability and tracing
- Shared state and message bus
- Configurable termination conditions
- Cost and token budget management across the team

---

## Phase 4: Deployment — Channels + CLI

**Goal:** Deploy agents to real-world messaging platforms and provide developer tooling.

### @openlinkos/channel-telegram
- Telegram Bot API integration
- Message, command, and callback query handling
- Rich message formatting (Markdown, inline keyboards)
- File and media support

### @openlinkos/cli
- `openlinkos init` — scaffold a new agent project with templates
- `openlinkos dev` — run an agent locally with hot reload
- `openlinkos build` — build for production
- `openlinkos deploy` — deploy to supported platforms
- Interactive agent playground in the terminal

---

## Phase 5: Ecosystem — More Channels + Plugins

**Goal:** Expand platform reach and extensibility.

### Additional Channels
- **@openlinkos/channel-feishu** — Feishu (Lark) bot integration with card messages and event subscriptions
- **@openlinkos/channel-discord** — Discord bot with slash commands, threads, and embeds
- **@openlinkos/channel-slack** — Slack app with Block Kit, slash commands, and event subscriptions
- **@openlinkos/channel-dingtalk** — DingTalk bot with interactive card messages

### Plugins
- **@openlinkos/plugin-memory** — Persistent agent memory with vector storage, semantic retrieval, and configurable retention policies

### Future Plugin Ideas
- `plugin-rag` — Retrieval-augmented generation with document ingestion and chunking
- `plugin-eval` — Agent evaluation and benchmarking harness
- `plugin-auth` — Authentication and authorization for agent endpoints
- `plugin-analytics` — Usage analytics, latency tracking, and cost dashboards
