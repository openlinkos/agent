# Multi-Agent Teams

Teams let you orchestrate multiple agents to collaborate on complex tasks. The `@openlinkos/team` package provides built-in coordination modes and shared communication primitives.

## Installation

```bash
pnpm add @openlinkos/team @openlinkos/agent @openlinkos/ai
```

## Coordination Modes

### Sequential (Pipeline)

Agents process the task one after another. Each agent's output becomes the next agent's input:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam } from "@openlinkos/team";

const model = createModel("openai:gpt-4o");

const researcher = createAgent({
  name: "researcher",
  model,
  systemPrompt: "Research the given topic and produce detailed findings.",
});

const writer = createAgent({
  name: "writer",
  model,
  systemPrompt: "Write a clear article based on the research provided.",
});

const editor = createAgent({
  name: "editor",
  model,
  systemPrompt: "Edit the article for grammar, clarity, and style.",
});

const team = createTeam({
  name: "content-pipeline",
  agents: [researcher, writer, editor],
  coordinationMode: "sequential",
});

const result = await team.run("Write an article about WebAssembly");
console.log(result.finalOutput);
```

### Parallel

All agents work on the task simultaneously. Results are aggregated using a configurable strategy:

```typescript
const team = createTeam({
  name: "analysis-team",
  agents: [securityAnalyst, performanceAnalyst, uxAnalyst],
  coordinationMode: "parallel",
  aggregationStrategy: "merge-all",
});

const result = await team.run("Review this application architecture");
```

Aggregation strategies:
- `"merge-all"` — Concatenate all responses (default)
- `"first-wins"` — Use the first response to complete
- `"majority-vote"` — Choose the most common answer
- `"custom"` — Provide a `customReducer` function

### Debate

Agents argue opposing perspectives. An optional judge evaluates and decides:

```typescript
const proponent = createAgent({
  name: "proponent",
  model,
  systemPrompt: "Argue in favor of the given proposition.",
});

const opponent = createAgent({
  name: "opponent",
  model,
  systemPrompt: "Argue against the given proposition.",
});

const judge = createAgent({
  name: "judge",
  model,
  systemPrompt: "Evaluate both arguments and render a fair decision.",
});

const team = createTeam({
  name: "debate-team",
  agents: [proponent, opponent],
  coordinationMode: "debate",
  judge,
  rounds: 3,
});

const result = await team.run("Should we migrate from REST to GraphQL?");
```

### Supervisor

A lead agent decomposes the task, delegates to workers, and synthesizes results:

```typescript
const manager = createAgent({
  name: "manager",
  model,
  systemPrompt: "You decompose tasks, delegate to team members, and synthesize their work.",
});

const team = createTeam({
  name: "project-team",
  agents: [manager, researcher, writer, reviewer],
  coordinationMode: "supervisor",
  supervisor: manager,
});

const result = await team.run("Produce a market analysis report on AI agents");
```

## Agent Roles

You can assign roles and descriptions to agents for richer coordination:

```typescript
const team = createTeam({
  name: "dev-team",
  agents: [
    { agent: architect, role: "architect", description: "Designs system architecture" },
    { agent: developer, role: "developer", description: "Implements features" },
    { agent: tester, role: "tester", description: "Writes and runs tests" },
  ],
  coordinationMode: "supervisor",
  supervisor: architect,
});
```

## Team Hooks

Observe the collaboration flow with lifecycle hooks:

```typescript
const team = createTeam({
  name: "observable-team",
  agents: [agent1, agent2],
  coordinationMode: "sequential",
  hooks: {
    onRoundStart: (round) => console.log(`Round ${round} starting`),
    onAgentStart: (name, round) => console.log(`  ${name} starting (round ${round})`),
    onAgentEnd: (name, response, round) => {
      console.log(`  ${name} done (${response.usage.totalTokens} tokens)`);
    },
    onRoundEnd: (round, results) => console.log(`Round ${round} complete`),
    onError: (error) => console.error(`Team error: ${error.message}`),
  },
});
```

## Max Rounds

Limit the number of collaboration rounds:

```typescript
const team = createTeam({
  name: "bounded-team",
  agents: [agent1, agent2],
  coordinationMode: "debate",
  maxRounds: 5,
});
```

## Inspecting Results

The `TeamResult` contains the full trace:

```typescript
const result = await team.run("Analyze this dataset");

console.log(result.finalOutput);       // Synthesized output
console.log(result.rounds);            // Number of rounds completed
console.log(result.totalUsage);        // Aggregated token usage
console.log(result.agentResults);      // Individual agent responses
```

## Next Steps

- [CLI Usage](/guide/cli) — Run teams from the command line
- See the full [Team API reference](/api/team)
- Try the [Debate example](/examples/debate) or [Supervisor example](/examples/supervisor)
