# @openlinkos/team

Multi-agent collaboration with supervisor, sequential, parallel, debate, and custom modes.

## Installation

```bash
pnpm add @openlinkos/team @openlinkos/agent @openlinkos/ai
```

## Overview

`@openlinkos/team` orchestrates groups of agents to collaborate on complex tasks. Five coordination modes are available out of the box, and you can implement custom coordination logic.

## `createTeam()`

```typescript
import { createTeam } from "@openlinkos/team";

const team = createTeam({
  name: "my-team",
  agents: [agent1, agent2],
  coordinationMode: "sequential",
});

const result = await team.run("Solve this problem");
```

**Signature:**

```typescript
function createTeam(config: TeamConfig): Team
```

## `TeamConfig`

```typescript
interface TeamConfig {
  /** Name of the team. */
  name: string;
  /** Agents participating. Can be plain agents or role-assigned agents. */
  agents: Array<Agent | AgentRole>;
  /** The coordination mode to use. */
  coordinationMode: CoordinationMode;
  /** Maximum number of collaboration rounds. */
  maxRounds?: number;
  /** Lifecycle hooks. */
  hooks?: TeamHooks;
}
```

## `CoordinationMode`

```typescript
type CoordinationMode = "sequential" | "parallel" | "debate" | "supervisor" | "custom";
```

## Mode-Specific Configuration

### Sequential

Agents process in order. No additional configuration needed.

```typescript
const team = createTeam({
  name: "pipeline",
  agents: [researcher, writer, editor],
  coordinationMode: "sequential",
});
```

### Parallel

All agents work simultaneously. Configure result aggregation:

```typescript
interface ParallelConfig extends TeamConfig {
  coordinationMode: "parallel";
  /** How to aggregate results. Default: "merge-all". */
  aggregationStrategy?: "first-wins" | "majority-vote" | "merge-all" | "custom";
  /** Custom reducer when aggregationStrategy is "custom". */
  customReducer?: (responses: AgentResponse[]) => string;
  /** Per-agent timeout in milliseconds. */
  agentTimeout?: number;
}
```

```typescript
const team = createTeam({
  name: "parallel-review",
  agents: [reviewer1, reviewer2, reviewer3],
  coordinationMode: "parallel",
  aggregationStrategy: "merge-all",
  agentTimeout: 30000,
});
```

### Debate

Agents argue opposing views. Optional judge decides:

```typescript
interface DebateConfig extends TeamConfig {
  coordinationMode: "debate";
  /** Judge agent to evaluate arguments. */
  judge?: Agent;
  /** Number of debate rounds. Default: 3. */
  rounds?: number;
}
```

```typescript
const team = createTeam({
  name: "debate",
  agents: [proponent, opponent],
  coordinationMode: "debate",
  judge: judgeAgent,
  rounds: 3,
});
```

### Supervisor

A lead agent decomposes and delegates:

```typescript
interface SupervisorConfig extends TeamConfig {
  coordinationMode: "supervisor";
  /** The supervisor agent. Defaults to the first agent. */
  supervisor?: Agent;
}
```

```typescript
const team = createTeam({
  name: "managed-team",
  agents: [manager, worker1, worker2],
  coordinationMode: "supervisor",
  supervisor: manager,
});
```

### Custom

Provide your own coordination function:

```typescript
interface CustomConfig extends TeamConfig {
  coordinationMode: "custom";
  coordinationFn: (
    agents: AgentRole[],
    input: string,
    context: TeamContext,
  ) => Promise<TeamResult>;
}
```

```typescript
const team = createTeam({
  name: "custom-team",
  agents: [agent1, agent2],
  coordinationMode: "custom",
  coordinationFn: async (agents, input, context) => {
    const results = [];
    for (const { agent } of agents) {
      const response = await agent.run(input);
      results.push(response);
    }
    return {
      finalOutput: results.map((r) => r.text).join("\n"),
      agentResults: results,
      rounds: 1,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  },
});
```

## `Team`

```typescript
interface Team {
  readonly name: string;
  readonly coordinationMode: CoordinationMode;
  run(input: string): Promise<TeamResult>;
}
```

## `TeamResult`

```typescript
interface TeamResult {
  /** The final synthesized output. */
  finalOutput: string;
  /** Individual agent results. */
  agentResults: AgentResponse[];
  /** Number of rounds completed. */
  rounds: number;
  /** Aggregated token usage. */
  totalUsage: Usage;
}
```

## `AgentRole`

```typescript
interface AgentRole {
  agent: Agent;
  role: string;
  description?: string;
  canDelegate?: boolean;
}
```

## `TeamHooks`

```typescript
interface TeamHooks {
  onRoundStart?: (round: number) => void | Promise<void>;
  onAgentStart?: (agentName: string, round: number) => void | Promise<void>;
  onAgentEnd?: (agentName: string, response: AgentResponse, round: number) => void | Promise<void>;
  onRoundEnd?: (round: number, results: AgentResponse[]) => void | Promise<void>;
  onConsensus?: (round: number, output: string) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}
```

## `TeamContext`

Shared state available during collaboration:

```typescript
interface TeamContext {
  blackboard: Map<string, unknown>;
  currentRound: number;
  previousResults: AgentResponse[];
  sendMessage: (from: string, to: string, content: string) => void;
  getMessages: (agentName: string) => TeamMessage[];
}
```

## Communication Primitives

### `MessageBus`

Inter-agent messaging:

```typescript
import { MessageBus } from "@openlinkos/team";

const bus = new MessageBus();
bus.send("agent-a", "agent-b", "Here are my findings...");
const messages = bus.getMessages("agent-b");
```

### `Blackboard`

Shared key-value state:

```typescript
import { Blackboard } from "@openlinkos/team";

const board = new Blackboard();
board.set("research", findings);
const data = board.get("research");
```
