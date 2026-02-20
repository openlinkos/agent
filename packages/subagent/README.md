# @openlinkos/subagent

Sub-agent specialization — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/subagent` enables agents to spawn, delegate to, and compose child agents with scoped capabilities. This package manages context windows, handoff strategies, and result aggregation across parent-child agent relationships.

## Installation

```bash
pnpm add @openlinkos/subagent @openlinkos/agent @openlinkos/ai
```

## Usage

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { spawnSubAgent } from "@openlinkos/subagent";

const model = createModel("openai:gpt-4o");

const result = await spawnSubAgent(
  {
    name: "researcher",
    model,
    systemPrompt: "You research topics thoroughly and report findings.",
    maxContextTokens: 4000,
    contextStrategy: "summary",
  },
  "Research WebAssembly use cases",
);

console.log(result.response.text);
```

## Features

- **Scoped capabilities** — Sub-agents receive only the context and tools they need
- **Context management** — Summarize, filter, or pass full context on handoff
- **Parallel delegation** — Send tasks to multiple sub-agents concurrently
- **Timeout and cancellation** — Prevent runaway sub-agent executions
- **Error recovery** — Configurable strategies for handling sub-agent failures
- **Result aggregation** — Merge results from multiple sub-agents

## License

[MIT](../../LICENSE)
