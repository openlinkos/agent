# 07 - Memory Conversation

Multi-turn conversation with persistent memory. Demonstrates single-session `Conversation` wrapping and multi-user `SessionManager` with `FileStore` persistence.

## What it demonstrates

**Part 1: Single-session Conversation**
- `createConversation` wraps an agent with persistent message history
- Each `conversation.send()` appends to the growing history
- The agent can reference earlier context (e.g. "going back to what you said...")
- `conversation.getHistory()` exposes the full message list

**Part 2: SessionManager with FileStore**
- `SessionManager` manages multiple independent user sessions
- `FileStore` persists sessions to disk (survives process restarts)
- `sessionManager.getSession(id)` loads existing or creates new sessions
- `sessionManager.saveSession(id)` writes session to disk

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/07-memory-conversation/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |

## Expected Output

```
=== 07 - Memory Conversation ===

──────────────────────────────────────────────────
📖  Part 1: Single-session Conversation with memory
──────────────────────────────────────────────────

👤  Student: Hi! I'm learning TypeScript and I'm struggling with generics.
🤖  Tutor: Great to meet you! Generics are one of TypeScript's most powerful features...
   [187 tokens | history: 3 messages]

👤  Student: Going back to what I said earlier about struggling with generics...
🤖  Tutor: Of course! Since you mentioned generics are tricky for you...
   [312 tokens | history: 9 messages]
```
