# Multi-Agent Debate

Two agents argue opposing sides of a topic, with a judge agent evaluating the arguments and rendering a final decision.

## Code

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam } from "@openlinkos/team";

const model = createModel("openai:gpt-4o");

// Create the debaters
const proponent = createAgent({
  name: "proponent",
  model,
  systemPrompt: `You argue IN FAVOR of the given proposition.
Build your case with logical reasoning, evidence, and concrete examples.
Address counterarguments raised by the opponent.
Be persuasive but intellectually honest.`,
});

const opponent = createAgent({
  name: "opponent",
  model,
  systemPrompt: `You argue AGAINST the given proposition.
Build your case with logical reasoning, evidence, and concrete examples.
Address counterarguments raised by the proponent.
Be persuasive but intellectually honest.`,
});

// Create the judge
const judge = createAgent({
  name: "judge",
  model,
  systemPrompt: `You are an impartial judge evaluating a debate.
After reviewing all arguments, provide:
1. A summary of each side's strongest points
2. An analysis of which arguments were most compelling
3. Your final ruling with clear reasoning`,
});

// Assemble the debate team
const team = createTeam({
  name: "debate-team",
  agents: [proponent, opponent],
  coordinationMode: "debate",
  judge,
  rounds: 3,
  hooks: {
    onRoundStart: (round) => {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`ROUND ${round}`);
      console.log("=".repeat(60));
    },
    onAgentStart: (name) => {
      console.log(`\n--- ${name.toUpperCase()} ---`);
    },
    onAgentEnd: (name, response) => {
      console.log(response.text.slice(0, 200) + "...");
    },
  },
});

// Run the debate
const result = await team.run("Should companies adopt a 4-day work week?");

console.log("\n" + "=".repeat(60));
console.log("FINAL RULING");
console.log("=".repeat(60));
console.log(result.finalOutput);
console.log(`\nTotal rounds: ${result.rounds}`);
console.log(`Total tokens: ${result.totalUsage.totalTokens}`);
```

## What This Demonstrates

- Creating a debate team with two opposing agents and a judge
- Multi-round argumentation where agents respond to each other
- Using team hooks to observe the debate as it unfolds
- The judge synthesizing arguments into a final decision

## Run It

```bash
export OPENAI_API_KEY=sk-...

npx tsx debate.ts
```

## Variations

### Without a Judge

Omit the `judge` to let the debate run without a final ruling. The output will be the last round's arguments:

```typescript
const team = createTeam({
  name: "open-debate",
  agents: [proponent, opponent],
  coordinationMode: "debate",
  rounds: 3,
});
```

### More Debaters

Add more agents for a multi-party debate:

```typescript
const pragmatist = createAgent({
  name: "pragmatist",
  model,
  systemPrompt: "You take a pragmatic middle-ground position, weighing costs and benefits.",
});

const team = createTeam({
  name: "panel-debate",
  agents: [proponent, opponent, pragmatist],
  coordinationMode: "debate",
  judge,
  rounds: 2,
});
```

### Using Debate for Red-Teaming

The debate pattern works well for adversarial evaluation:

```typescript
const system = createAgent({
  name: "system",
  model,
  systemPrompt: "You defend this system design and explain why it is secure and correct.",
});

const redTeam = createAgent({
  name: "red-team",
  model,
  systemPrompt: "You are a red teamer. Find weaknesses, security flaws, and edge cases.",
});

const team = createTeam({
  name: "security-review",
  agents: [system, redTeam],
  coordinationMode: "debate",
  judge,
  rounds: 3,
});

const result = await team.run("Review this authentication flow: JWT tokens with 24h expiry...");
```
