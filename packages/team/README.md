# @openlinkos/team

Multi-agent collaboration — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/team` is the framework's core differentiator. It provides built-in collaboration patterns for orchestrating groups of agents to solve complex tasks together.

## Installation

```bash
pnpm add @openlinkos/team @openlinkos/agent @openlinkos/ai
```

## Collaboration Modes

### Supervisor

A lead agent receives the task, decomposes it into sub-tasks, delegates to worker agents, reviews their outputs, and synthesizes the final result.

```typescript
const team = createTeam({
  mode: "supervisor",
  agents: [supervisor, researcher, writer, reviewer],
  supervisor: supervisor,
});
```

### Swarm

Agents self-organize around a shared task. Each agent claims sub-tasks, works on them, and publishes results. The swarm converges when consensus is reached.

```typescript
const team = createTeam({
  mode: "swarm",
  agents: [agent1, agent2, agent3],
  topology: "broadcast",
});
```

### Pipeline

Sequential processing where each agent transforms the input and passes it to the next. Supports conditional routing and parallel fan-out.

```typescript
const team = createTeam({
  mode: "pipeline",
  agents: [researcher, writer, editor],
});
```

### Debate

Agents argue opposing perspectives on a topic. A judge agent evaluates the arguments and produces a final ruling.

```typescript
const team = createTeam({
  mode: "debate",
  agents: [proponent, opponent],
  judge: judgeAgent,
  rounds: 3,
});
```

## Features

- **Four collaboration modes** — Supervisor, swarm, pipeline, and debate
- **Shared state** — Agents communicate through a shared message bus and scratchpad
- **Team-level observability** — Trace the full collaboration flow
- **Budget management** — Token and cost budgets across the team
- **Configurable termination** — Stop on consensus, budget exhaustion, or max rounds

## License

[MIT](../../LICENSE)
