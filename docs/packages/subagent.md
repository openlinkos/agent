# @openlinkos/subagent

Sub-agent specialization for spawning, delegating to, and composing child agents.

## Overview

`@openlinkos/subagent` enables agents to spawn, delegate to, and compose child agents with scoped capabilities. This package manages context windows, handoff strategies, and result aggregation across parent-child agent relationships.

## Installation

```bash
pnpm add @openlinkos/subagent @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createModel } from "@openlinkos/ai";
import { createSubAgentManager } from "@openlinkos/subagent";

const manager = createSubAgentManager();
const model = createModel("openai:gpt-4o");

const researcher = manager.spawn({
  name: "researcher",
  model,
  systemPrompt: "You research topics thoroughly and report findings.",
  maxContextTokens: 4000,
  contextStrategy: "summary",
});

const result = await manager.delegate(researcher, "Research WebAssembly use cases");
console.log(result.response.text);
```

## Features

- **Scoped capabilities** — Sub-agents receive only the context and tools they need
- **Context management** — Summarize, filter, or pass full context on handoff
- **Parallel delegation** — Send tasks to multiple sub-agents concurrently
- **Timeout and cancellation** — Prevent runaway sub-agent executions
- **Error recovery** — Configurable strategies for handling sub-agent failures
- **Result aggregation** — Merge results from multiple sub-agents
