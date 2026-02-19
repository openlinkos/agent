# Teams

Teams are the core differentiator of the OpenLinkOS Agent Framework. A team orchestrates multiple agents to collaborate on complex tasks using one of four built-in collaboration modes.

## Collaboration Modes

### Supervisor

A lead agent receives the task, decomposes it into sub-tasks, delegates to worker agents, reviews their outputs, and synthesizes the final result.

```typescript
import { createTeam } from "@openlinkos/team";

const team = createTeam({
  mode: "supervisor",
  agents: [manager, researcher, writer, reviewer],
  supervisor: manager,
});

const result = await team.run("Produce a market analysis report on AI agents");
```

**When to use:** Complex tasks that benefit from centralized planning and quality control.

### Swarm

Agents self-organize around a shared task without a central coordinator. Each agent can claim sub-tasks, work on them, and publish results. The swarm converges when agents reach consensus or exhaust the task space.

```typescript
const team = createTeam({
  mode: "swarm",
  agents: [analyst1, analyst2, analyst3],
  topology: "broadcast",
});

const result = await team.run("Identify all security vulnerabilities in this codebase");
```

**When to use:** Exploration tasks where multiple perspectives are valuable and no single agent should dominate.

### Pipeline

Sequential processing where each agent transforms the input and passes it to the next stage. The output of one agent becomes the input of the next.

```typescript
const team = createTeam({
  mode: "pipeline",
  agents: [researcher, writer, editor, factChecker],
});

const result = await team.run("Write a technical article about WebAssembly");
```

**When to use:** Multi-stage workflows with clear handoff points between specialized roles.

### Debate

Two or more agents argue opposing perspectives on a topic. A judge agent evaluates the arguments across multiple rounds and produces a final ruling.

```typescript
const team = createTeam({
  mode: "debate",
  agents: [proponent, opponent],
  judge: judgeAgent,
  rounds: 3,
});

const result = await team.run("Should we migrate from REST to GraphQL?");
```

**When to use:** Decision-making, adversarial evaluation, red-teaming, and exploring trade-offs.

## Configuration

### Max Rounds

Limit the number of collaboration rounds to control cost and latency:

```typescript
const team = createTeam({
  mode: "supervisor",
  agents: [manager, worker1, worker2],
  maxRounds: 5,
});
```

### Swarm Topology

Control how agents communicate in swarm mode:

| Topology | Description |
|----------|-------------|
| `broadcast` | Every agent sees every message |
| `peer-to-peer` | Agents communicate directly with specific peers |
| `ring` | Messages pass around a ring of agents |

## Observability

Team execution produces a full trace of inter-agent communication:

```typescript
const result = await team.run("Build a comprehensive test suite");

// Inspect individual agent contributions
for (const agentResponse of result.agentResponses) {
  console.log(`[${agentResponse.agentName}]: ${agentResponse.text}`);
}
```

## Choosing the Right Mode

| Factor | Supervisor | Swarm | Pipeline | Debate |
|--------|-----------|-------|----------|--------|
| Coordination | Centralized | Decentralized | Sequential | Structured |
| Best for | Complex projects | Exploration | Workflows | Decisions |
| Communication | Hub-and-spoke | Peer-to-peer | Linear | Adversarial |
| Scalability | Moderate | High | Linear | Fixed |

## Budget Management

Set token and cost budgets for the entire team to prevent runaway costs:

```typescript
const team = createTeam({
  mode: "supervisor",
  agents: [manager, worker1, worker2],
  budget: {
    maxTokens: 100000,
    maxCostUSD: 5.0,
  },
});
```

The team stops gracefully when the budget is exhausted, returning whatever results have been produced so far.
