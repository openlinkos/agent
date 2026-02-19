# Sub-agents

Sub-agents allow a parent agent to spawn, delegate to, and compose specialized child agents. This enables complex task decomposition where each sub-agent handles a focused piece of work with its own tools, context, and constraints.

## When to Use Sub-agents

Sub-agents are useful when:

- A task requires **different expertise** at different stages (e.g., research then writing)
- You need to **limit context** — give a child agent only the information it needs
- You want to **parallelize** work by delegating to multiple agents simultaneously
- The task is too large for a single agent's context window

## Creating a Sub-agent Manager

```typescript
import { createModel } from "@openlinkos/ai";
import { createSubAgentManager } from "@openlinkos/subagent";

const model = createModel("openai:gpt-4o");
const manager = createSubAgentManager();
```

## Spawning Sub-agents

Spawn sub-agents with scoped configurations. Each sub-agent gets its own system prompt, tools, and context limits:

```typescript
const researcher = manager.spawn({
  name: "researcher",
  model,
  systemPrompt: "You research topics thoroughly and report findings as bullet points.",
  maxContextTokens: 4000,
  contextStrategy: "summary",
});

const analyst = manager.spawn({
  name: "analyst",
  model,
  systemPrompt: "You analyze data and produce insights with supporting evidence.",
  maxContextTokens: 8000,
  contextStrategy: "selective",
});
```

## Delegating Tasks

Delegate a specific task to a sub-agent and get back the result:

```typescript
const result = await manager.delegate(
  researcher,
  "Research the current state of WebAssembly adoption in production"
);

if (result.success) {
  console.log(result.response.text);
} else {
  console.error("Delegation failed:", result.error);
}
```

## Parallel Delegation

Send tasks to multiple sub-agents concurrently:

```typescript
const results = await manager.delegateAll(
  [researcher, analyst],
  "Evaluate the pros and cons of server-side rendering"
);

for (const result of results) {
  console.log(`${result.agentName}: ${result.response.text}`);
}
```

## Context Strategies

Control how much context a sub-agent receives:

| Strategy | Description |
|----------|-------------|
| `full` | Pass the entire parent context to the sub-agent |
| `summary` | Summarize the parent context before passing it |
| `selective` | Pass only the most relevant portions of context |

## Error Handling

Sub-agent delegations can fail due to timeouts, model errors, or task complexity. The `DelegationResult` provides structured error information:

```typescript
const result = await manager.delegate(researcher, "Some complex task");

if (!result.success) {
  // Handle the failure — retry, try a different agent, or escalate
  console.error(`Agent ${result.agentName} failed: ${result.error}`);
}
```

## Sub-agents vs. Teams

| Aspect | Sub-agents | Teams |
|--------|-----------|-------|
| Coordination | Parent manages children | Agents coordinate together |
| Communication | Parent ↔ child only | All agents can communicate |
| Use case | Task delegation | Collaborative problem solving |
| Package | `@openlinkos/subagent` | `@openlinkos/team` |

Use sub-agents when a parent agent needs helpers. Use teams when agents need to collaborate as equals.
