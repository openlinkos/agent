# @openlinkos/subagent

Sub-agent spawning, delegation, and parallel execution.

## Installation

```bash
pnpm add @openlinkos/subagent @openlinkos/agent @openlinkos/ai
```

## Overview

`@openlinkos/subagent` enables agents to spawn child agents with scoped capabilities. Sub-agents can run in parallel with concurrency control.

## `spawnSubAgent()`

Spawn and run a single sub-agent:

```typescript
import { createModel } from "@openlinkos/ai";
import { spawnSubAgent } from "@openlinkos/subagent";

const model = createModel("openai:gpt-4o");

const result = await spawnSubAgent(
  {
    name: "researcher",
    model,
    systemPrompt: "You research topics thoroughly.",
    contextStrategy: "summary",
    maxContextTokens: 4000,
  },
  "Research the history of TypeScript",
);

console.log(result.response.text);
console.log(`Completed in ${result.durationMs}ms`);
```

**Signature:**

```typescript
function spawnSubAgent(
  config: SubAgentConfig,
  input: string,
  options?: SpawnOptions,
  onProgress?: ProgressCallback,
  currentDepth?: number,
): Promise<SubAgentResult>
```

## `spawnParallel()`

Spawn multiple sub-agents concurrently:

```typescript
import { spawnParallel } from "@openlinkos/subagent";

const results = await spawnParallel(
  [
    {
      name: "frontend-researcher",
      model,
      systemPrompt: "Research frontend frameworks.",
    },
    {
      name: "backend-researcher",
      model,
      systemPrompt: "Research backend frameworks.",
    },
  ],
  [
    "Compare React, Vue, and Svelte",
    "Compare Express, Fastify, and Hono",
  ],
);

for (const result of results) {
  console.log(`${result.agentName}: ${result.response.text}`);
}
```

**Signature:**

```typescript
function spawnParallel(
  configs: SubAgentConfig[],
  inputs: string[],
  options?: SpawnOptions,
  onProgress?: ProgressCallback,
): Promise<SubAgentResult[]>
```

## `SubAgentConfig`

Extends `AgentConfig` with delegation-specific settings:

```typescript
interface SubAgentConfig extends AgentConfig {
  /** Timeout in milliseconds. Default: 60000. */
  timeoutMs?: number;
  /** Maximum context tokens to pass. */
  maxContextTokens?: number;
  /** How to inherit context from the parent. */
  contextStrategy?: "full" | "summary" | "selective";
}
```

### Context Strategies

| Strategy | Description |
|----------|-------------|
| `"full"` | Pass the entire parent context to the sub-agent |
| `"summary"` | Summarize parent context before passing |
| `"selective"` | Pass only the most relevant portions |

## `SubAgentResult`

```typescript
interface SubAgentResult {
  agentName: string;
  response: AgentResponse;
  success: boolean;
  error?: string;
  durationMs: number;
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  steps: number;
}
```

## `SpawnOptions`

```typescript
interface SpawnOptions {
  /** Timeout per sub-agent in milliseconds. Default: 60000. */
  timeout?: number;
  /** Maximum concurrent sub-agents. Default: 5. */
  maxConcurrent?: number;
  /** Context inheritance mode. */
  contextInheritance?: "none" | "system-prompt" | "full-history";
  /** Maximum nesting depth. Default: 3. */
  maxDepth?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}
```

## Progress Tracking

Monitor sub-agent execution with progress callbacks:

```typescript
import { createProgressCollector, summarizeResults } from "@openlinkos/subagent";

const collector = createProgressCollector((update) => {
  console.log(`[${update.agentName}] ${update.type}: ${update.message}`);
});

const result = await spawnSubAgent(
  {
    name: "researcher",
    model,
    systemPrompt: "Research this topic.",
  },
  "What is WebAssembly?",
  {},
  collector.callback,
);

const summary = summarizeResults([result]);
console.log(summary);
```

### `ProgressUpdate`

```typescript
interface ProgressUpdate {
  agentName: string;
  type: "started" | "step" | "tool_call" | "completed" | "failed";
  message: string;
  timestamp: number;
  stepNumber?: number;
}
```
