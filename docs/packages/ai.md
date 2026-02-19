# @openlinkos/ai

Unified model invocation layer for LLM providers.

## Overview

`@openlinkos/ai` provides a single interface for interacting with multiple LLM providers. Write your agent logic once and swap models without changing application code.

### Supported Providers

- OpenAI (GPT-4o, GPT-4, GPT-3.5)
- Anthropic (Claude 3.5, Claude 3)
- Google Gemini (Gemini Pro, Gemini Ultra)
- Ollama (local open-source models)

## Installation

```bash
pnpm add @openlinkos/ai
```

## Usage

```typescript
import { createModel } from "@openlinkos/ai";

const model = createModel("openai:gpt-4o");

const response = await model.generate([
  { role: "user", content: "Explain quantum computing in one sentence." }
]);

console.log(response.text);
```

## Features

- **Provider-agnostic API** — Uniform interface across all supported providers
- **Tool calling** — Automatic schema generation and tool execution
- **Structured output** — Schema-validated JSON responses using Zod
- **Streaming** — Token-by-token streaming with backpressure support
- **Token tracking** — Usage accounting for cost management
- **Retry & fallback** — Automatic retries and fallback to alternative models
