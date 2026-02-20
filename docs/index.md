---
layout: home

hero:
  name: OpenLinkOS
  text: AI Agent Framework
  tagline: Build, orchestrate, and deploy AI agents — from single assistants to collaborative multi-agent teams.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: API Reference
      link: /api/ai
    - theme: alt
      text: GitHub
      link: https://github.com/openlinkos/agent

features:
  - icon: "\U0001F9E0"
    title: Unified Model Layer
    details: One interface for OpenAI, Anthropic, Google Gemini, and Ollama. Switch providers without changing code. Built-in retry, fallback, and streaming.
    link: /api/ai
    linkText: AI API Reference
  - icon: "\U0001F916"
    title: Agent Engine
    details: ReAct-style reasoning loops with tool calling, input/output guardrails, content filters, and full lifecycle hooks for observability.
    link: /guide/first-agent
    linkText: Build Your First Agent
  - icon: "\U0001F465"
    title: Multi-Agent Teams
    details: Supervisor, sequential, parallel, and debate coordination modes. Shared blackboard, message bus, and team-level observability.
    link: /guide/teams
    linkText: Team Guide
  - icon: "\U0001F527"
    title: MCP Tools
    details: First-class Model Context Protocol support. Connect to any MCP tool server over stdio, SSE, or WebSocket.
    link: /api/mcp
    linkText: MCP API Reference
  - icon: "\U0001F4AC"
    title: Channel Integrations
    details: Deploy agents to terminal, web, Telegram, Discord, Slack, Feishu, and DingTalk with a unified channel abstraction.
    link: /api/channels
    linkText: Channel API Reference
  - icon: "\U0001F9E9"
    title: Plugins & Memory
    details: Extend agents with composable plugins. Built-in persistent memory with conversation, key-value, and vector search.
    link: /api/memory
    linkText: Memory API Reference
---

<div class="vp-doc" style="max-width: 688px; margin: 0 auto; padding: 48px 24px;">

## Quick Start

Install the core packages and create your first agent in under a minute:

```bash
pnpm add @openlinkos/ai @openlinkos/agent
```

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

const agent = createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
  tools: [
    {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      },
      execute: async ({ city }) => {
        return { temperature: 22, condition: "sunny", city };
      },
    },
  ],
});

const response = await agent.run("What's the weather in Tokyo?");
console.log(response.text);
```

<div style="display: flex; gap: 12px; margin-top: 24px;">
  <a href="/agent/guide/" style="display: inline-block; padding: 8px 16px; background: var(--vp-c-brand-1); color: var(--vp-c-white); border-radius: 6px; text-decoration: none; font-weight: 500;">Read the Guide</a>
  <a href="/agent/examples/chatbot" style="display: inline-block; padding: 8px 16px; border: 1px solid var(--vp-c-divider); border-radius: 6px; text-decoration: none; font-weight: 500;">View Examples</a>
</div>

</div>
