# 02 - Streaming Chat

An interactive CLI chatbot that streams responses token-by-token, with full conversation memory.

## What it demonstrates

- `model.stream()` for real-time streaming responses
- Iterating over `StreamEvent` objects (`text_delta`, `done`)
- Maintaining conversation history for multi-turn chat
- Graceful stdin/stdout handling for interactive CLI apps

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Setup

```bash
cp examples/.env.example examples/.env
# Edit .env and set OPENAI_API_KEY=sk-...
```

## Run

```bash
npx tsx examples/02-streaming-chat/index.ts
```

Then type your messages and press Enter. Type `exit` to quit.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |

## Expected Output

```
=== 02 - Streaming Chat ===
Model: gpt-4o-mini
Type your message and press Enter. Type "exit" to quit.

Chat started! ✨

You: Tell me a fun fact
Assistant: Did you know that honey never spoils? Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible!

[Tokens: 43 total]

You: exit
Goodbye! 👋
```
