# Teams

Teams are the core differentiator of the OpenLinkOS Agent Framework. A team orchestrates multiple agents to collaborate on complex tasks using one of four built-in collaboration modes.

## Collaboration Modes

### Sequential

Agents process the task one after another. The output of one agent becomes the input of the next.

```typescript
import { createTeam } from "@openlinkos/team";

const team = createTeam({
  name: "content-pipeline",
  coordinationMode: "sequential",
  agents: [researcher, writer, editor, factChecker],
});

const result = await team.run("Write a technical article about WebAssembly");
```

**When to use:** Multi-stage workflows with clear handoff points between specialized roles.

### Parallel

All agents work on the task simultaneously. Results are aggregated using a configurable strategy.

```typescript
const team = createTeam({
  name: "analysis-team",
  coordinationMode: "parallel",
  agents: [analyst1, analyst2, analyst3],
  aggregationStrategy: "merge-all",
});

const result = await team.run("Identify all security vulnerabilities in this codebase");
```

**When to use:** Exploration tasks where multiple perspectives are valuable and independent analysis is preferred.

### Supervisor

A lead agent receives the task, decomposes it into sub-tasks, delegates to worker agents, reviews their outputs, and synthesizes the final result.

```typescript
const team = createTeam({
  name: "project-team",
  coordinationMode: "supervisor",
  agents: [manager, researcher, writer, reviewer],
  supervisor: manager,
});

const result = await team.run("Produce a market analysis report on AI agents");
```

**When to use:** Complex tasks that benefit from centralized planning and quality control.

### Debate

Two or more agents argue opposing perspectives on a topic. A judge agent evaluates the arguments across multiple rounds and produces a final ruling.

```typescript
const team = createTeam({
  name: "debate-team",
  coordinationMode: "debate",
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
  name: "bounded-team",
  coordinationMode: "supervisor",
  agents: [manager, worker1, worker2],
  maxRounds: 5,
});
```

## Observability

Team execution produces a full trace of inter-agent communication:

```typescript
const result = await team.run("Build a comprehensive test suite");

// Inspect individual agent contributions
for (const agentResponse of result.agentResults) {
  console.log(`[${agentResponse.agentName}]: ${agentResponse.text}`);
}
```

## Choosing the Right Mode

| Factor | Sequential | Parallel | Supervisor | Debate |
|--------|-----------|----------|------------|--------|
| Coordination | Sequential | Concurrent | Centralized | Structured |
| Best for | Workflows | Exploration | Complex projects | Decisions |
| Communication | Linear | Independent | Hub-and-spoke | Adversarial |
| Scalability | Linear | High | Moderate | Fixed |

## Budget Management

Set token and cost budgets for the entire team to prevent runaway costs:

```typescript
const team = createTeam({
  name: "budget-team",
  coordinationMode: "supervisor",
  agents: [manager, worker1, worker2],
  maxRounds: 10,
});
```

The team stops gracefully when the max rounds are exhausted, returning whatever results have been produced so far.
