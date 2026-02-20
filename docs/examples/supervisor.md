# Supervisor Pattern

A supervisor agent decomposes a complex task, delegates sub-tasks to specialized workers, and synthesizes the final output.

## Code

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam } from "@openlinkos/team";

const model = createModel("openai:gpt-4o");

// The supervisor decomposes and coordinates
const manager = createAgent({
  name: "manager",
  model,
  systemPrompt: `You are a project manager who coordinates a team.
When given a task:
1. Break it into specific sub-tasks
2. Assign each sub-task to the most appropriate team member
3. Review the outputs from each team member
4. Synthesize a final, cohesive deliverable

Your team members are:
- researcher: finds and analyzes information
- writer: creates clear, well-structured content
- reviewer: checks for accuracy, quality, and completeness`,
});

// Specialized workers
const researcher = createAgent({
  name: "researcher",
  model,
  systemPrompt: `You are a thorough researcher. When given a research task:
- Gather relevant facts and data
- Identify key themes and trends
- Provide well-organized findings with sources where possible`,
});

const writer = createAgent({
  name: "writer",
  model,
  systemPrompt: `You are a skilled technical writer. When given content to write:
- Use clear, concise language
- Structure content with headings and bullet points
- Tailor the tone to the target audience`,
});

const reviewer = createAgent({
  name: "reviewer",
  model,
  systemPrompt: `You are a meticulous reviewer. When reviewing content:
- Check for factual accuracy
- Identify gaps or missing information
- Suggest specific improvements
- Rate overall quality from 1-10`,
});

// Assemble the team
const team = createTeam({
  name: "content-team",
  agents: [
    { agent: manager, role: "supervisor", description: "Coordinates the team" },
    { agent: researcher, role: "researcher", description: "Researches topics" },
    { agent: writer, role: "writer", description: "Writes content" },
    { agent: reviewer, role: "reviewer", description: "Reviews quality" },
  ],
  coordinationMode: "supervisor",
  supervisor: manager,
  maxRounds: 5,
  hooks: {
    onAgentStart: (name, round) => {
      console.log(`[Round ${round}] ${name} is working...`);
    },
    onAgentEnd: (name, response, round) => {
      console.log(`[Round ${round}] ${name} finished (${response.usage.totalTokens} tokens)`);
    },
    onRoundEnd: (round) => {
      console.log(`--- Round ${round} complete ---\n`);
    },
  },
});

// Run the team
const result = await team.run(
  "Create a comprehensive guide to WebAssembly for web developers"
);

console.log("=== FINAL OUTPUT ===");
console.log(result.finalOutput);
console.log(`\nRounds: ${result.rounds}`);
console.log(`Total tokens: ${result.totalUsage.totalTokens}`);

// Inspect individual contributions
for (const agentResult of result.agentResults) {
  console.log(`\n--- ${agentResult.agentName} ---`);
  console.log(agentResult.text.slice(0, 150) + "...");
}
```

## What This Demonstrates

- Supervisor coordination mode with a manager agent
- Assigning roles and descriptions to team members
- The supervisor decomposing tasks and delegating to specialists
- Using hooks to observe the collaboration flow
- Inspecting individual agent contributions from the result

## Run It

```bash
export OPENAI_API_KEY=sk-...

npx tsx supervisor.ts
```

## Variations

### With Tool-Using Workers

Give workers specialized tools:

```typescript
const researcher = createAgent({
  name: "researcher",
  model,
  systemPrompt: "You research topics using your search tool.",
  tools: [
    {
      name: "search",
      description: "Search for information on a topic",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      execute: async ({ query }) => {
        // Real search implementation
        return { results: [`Info about ${query}`] };
      },
    },
  ],
});
```

### Pipeline After Supervision

Combine supervisor with sequential for post-processing:

```typescript
// First: supervisor produces draft
const draftTeam = createTeam({
  name: "draft-team",
  agents: [manager, researcher, writer],
  coordinationMode: "supervisor",
  supervisor: manager,
});

// Then: sequential editing pipeline
const editTeam = createTeam({
  name: "edit-pipeline",
  agents: [editor, factChecker, formatter],
  coordinationMode: "sequential",
});

// Run both
const draft = await draftTeam.run("Write about Rust programming");
const final = await editTeam.run(draft.finalOutput);
console.log(final.finalOutput);
```
