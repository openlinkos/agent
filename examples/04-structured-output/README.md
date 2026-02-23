# 04 - Structured Output

Generate **type-safe, schema-validated JSON objects** from the LLM using `generateObject`.

## What it demonstrates

- `generateObject<T>()` for structured data extraction
- Defining `JSONSchema` for response validation
- Automatic retry on schema validation failure
- TypeScript generic types aligned with JSON schemas

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/04-structured-output/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |

## Expected Output

```
=== 04 - Structured Output ===

📚 Generating structured book review...

📖  "The Pragmatic Programmer" by David Thomas and Andrew Hunt
⭐  Rating: 9/10
📝  Summary: A classic software engineering book...
✅  Pros:
    • Practical advice applicable to any language
    • Timeless principles
❌  Cons:
    • Some examples feel dated
💡  Recommended: Yes
📊  Tokens: 312

📋 Generating structured task list...

🗂️  Task List:
  1. 🔴 Set up project structure
     Priority: high | Est: 2h | Tags: setup, backend
  ...

⏱️  Total estimated: 14 hours
```
