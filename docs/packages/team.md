# @openlinkos/team

Multi-agent collaboration with sequential, parallel, supervisor, and debate patterns.

## Overview

`@openlinkos/team` is the framework's core differentiator. It provides built-in collaboration patterns for orchestrating groups of agents to solve complex tasks together.

## Installation

```bash
pnpm add @openlinkos/team @openlinkos/agent @openlinkos/ai
```

## Collaboration Modes

### Sequential

Agents process the task one after another. Each agent's output becomes the next agent's input.

```typescript
const team = createTeam({
  name: "content-pipeline",
  coordinationMode: "sequential",
  agents: [researcher, writer, editor],
});
```

### Parallel

All agents work on the task simultaneously. Results are aggregated using a configurable strategy.

```typescript
const team = createTeam({
  name: "analysis-team",
  coordinationMode: "parallel",
  agents: [agent1, agent2, agent3],
  aggregationStrategy: "merge-all",
});
```

### Supervisor

A lead agent receives the task, decomposes it into sub-tasks, delegates to worker agents, reviews their outputs, and synthesizes the final result.

```typescript
const team = createTeam({
  name: "project-team",
  coordinationMode: "supervisor",
  agents: [supervisor, researcher, writer, reviewer],
  supervisor: supervisor,
});
```

### Debate

Agents argue opposing perspectives on a topic. A judge agent evaluates the arguments and produces a final ruling.

```typescript
const team = createTeam({
  name: "debate-team",
  coordinationMode: "debate",
  agents: [proponent, opponent],
  judge: judgeAgent,
  rounds: 3,
});
```

## Features

- **Four collaboration modes** — Sequential, parallel, supervisor, and debate
- **Shared state** — Agents communicate through a shared message bus and scratchpad
- **Team-level observability** — Trace the full collaboration flow
- **Budget management** — Token and cost budgets across the team
- **Configurable termination** — Stop on consensus, budget exhaustion, or max rounds
