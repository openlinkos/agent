# Supervisor Team

A supervisor agent decomposes a task, delegates to specialized workers, and synthesizes the final output.

## What it demonstrates

- Creating a supervisor team with `createTeam()` in `"supervisor"` coordination mode
- Assigning roles and descriptions to team members via `AgentRole`
- The supervisor decomposing tasks and delegating to specialists
- Using hooks to observe the collaboration flow
- Inspecting individual agent contributions from the result

## Run

```bash
npx tsx supervisor.ts
```

## Key concepts

- **Supervisor mode**: One agent acts as coordinator, breaking down tasks and delegating to workers.
- **Agent roles**: Each agent has a `role` and `description` that the supervisor uses for delegation.
- **Multi-round coordination**: The supervisor orchestrates multiple rounds of work across team members.
- **Result aggregation**: The final output is synthesized from individual agent contributions.
