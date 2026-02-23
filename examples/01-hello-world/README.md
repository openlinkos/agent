# 01 - Hello World

The simplest possible OpenLinkOS Agent Framework example. Sends a single message to an LLM and prints the response.

## What it demonstrates

- Registering a provider with `registerProvider`
- Creating a model with `createModel`
- Generating a response with `model.generate`
- Reading token usage from the response

## Prerequisites

1. An OpenAI-compatible API key
2. Node.js ≥ 18

## Setup

```bash
# From the repo root
cp examples/.env.example examples/.env
# Edit examples/.env and set OPENAI_API_KEY=sk-...
```

Or pass the key inline:

```bash
OPENAI_API_KEY=sk-... npx tsx examples/01-hello-world/index.ts
```

## Run

```bash
npx tsx examples/01-hello-world/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI (or compatible) API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL (for OpenAI-compatible APIs) |

## Expected Output

```
=== 01 - Hello World ===

📡  Using model: openai:gpt-4o-mini
📨  Sending: "Hello! Who are you and what can you do?"

🤖  Response:
I'm an AI assistant built with the OpenLinkOS Agent Framework...

📊  Tokens used: 87 (prompt: 52, completion: 35)
✅  Finish reason: stop
```
