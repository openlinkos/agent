# Skills

Skills are reusable, self-contained bundles of behavior that can be attached to any agent. A skill packages a system prompt fragment, a set of tools, and optional configuration into a portable unit that gives agents specific capabilities.

## What is a Skill?

While tools provide individual functions an agent can call, a skill is a higher-level abstraction that combines:

- **Prompt instructions** — Context and guidelines for using the skill
- **Tools** — One or more tool definitions the skill requires
- **Configuration** — Settings that customize the skill's behavior

Think of skills as "capability packs" — attach a skill to an agent and it immediately gains that capability.

## Defining a Skill

```typescript
import { defineSkill } from "@openlinkos/agent";

const webSearchSkill = defineSkill({
  name: "web-search",
  description: "Search the web and summarize results",

  instructions: `
    When the user asks you to search for something, use the search tool
    to find relevant results. Summarize the top results concisely and
    cite your sources.
  `,

  tools: [
    {
      name: "search",
      description: "Search the web for a query",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          maxResults: { type: "number", description: "Maximum results to return" },
        },
        required: ["query"],
      },
      execute: async ({ query, maxResults = 5 }) => {
        // Implementation here
        return { results: [] };
      },
    },
  ],
});
```

## Attaching Skills to Agents

```typescript
import { createAgent } from "@openlinkos/agent";
import { createModel } from "@openlinkos/ai";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "research-assistant",
  model,
  systemPrompt: "You are a research assistant.",
  skills: [webSearchSkill],
});
```

When a skill is attached, its instructions are appended to the agent's system prompt and its tools are added to the agent's toolset.

## Composing Skills

Agents can use multiple skills simultaneously. Each skill's tools and instructions are merged:

```typescript
const agent = createAgent({
  name: "full-assistant",
  model,
  systemPrompt: "You are a versatile assistant.",
  skills: [webSearchSkill, codeAnalysisSkill, dataVisualizationSkill],
});
```

## Skill vs. Plugin

| Aspect | Skill | Plugin |
|--------|-------|--------|
| Purpose | Adds domain-specific capabilities | Extends framework infrastructure |
| Contains | Prompts + tools + config | Lifecycle hooks + state management |
| Scope | User-facing behavior | System-level concerns |
| Examples | Web search, code analysis | Memory, logging, authentication |

Use skills for things the agent *does* and plugins for things the agent *uses*.
