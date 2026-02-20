# Multi-Agent Debate

Two agents argue opposing sides of a topic, with an optional judge agent rendering a final decision.

## What it demonstrates

- Creating a debate team with `createTeam()` in `"debate"` coordination mode
- Two agents with opposing system prompts (proponent vs opponent)
- A judge agent that evaluates arguments and provides a ruling
- Team lifecycle hooks for observing each round
- Mock provider with position-aware canned responses

## Run

```bash
npx tsx debate.ts
```

## Key concepts

- **Debate mode**: Agents take turns arguing, each seeing previous arguments in context.
- **Judge**: An optional third agent that reviews all arguments and produces a final synthesis.
- **Rounds**: The debate runs for a configured number of rounds (default: 3).
- **Hooks**: `onRoundStart`, `onAgentStart`, `onAgentEnd`, `onRoundEnd` let you observe the debate as it unfolds.
