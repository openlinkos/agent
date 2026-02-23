# 08 - Workflow Pipeline

A **multi-step AI content generation pipeline** where each step's output feeds automatically into the next. Demonstrates the full power of `createWorkflow` for orchestrating complex agent tasks.

## Pipeline Architecture

```
Input (topic)
     │
     ▼
┌─────────────┐     ┌──────────┐     ┌────────┐     ┌───────────────┐     ┌────────┐
│  researcher  │────►│ outliner │────►│ writer │────►│ add-metadata  │────►│reviewer│
│  (facts)    │     │(outline) │     │(draft) │     │ (fn: wordcount)│    │(score) │
└─────────────┘     └──────────┘     └────────┘     └───────────────┘     └────────┘
```

**Steps:**
1. **research** — Gather 5-7 key facts about the topic (agent)
2. **outline** — Create a structured article outline (agent)
3. **write** — Expand the outline into a ~300-word draft (agent)
4. **add-metadata** — Count words and add timestamp (plain function)
5. **review** — Score and critique the draft (agent)

## What it demonstrates

- `createWorkflow` with `WorkflowStep[]`
- Agent steps (`agent:`) and plain function steps (`fn:`)
- `inputTransform` / `outputTransform` for data shaping between steps
- `onStepComplete` hook for progress tracking
- `result.stepResults` for accessing intermediate outputs

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/08-workflow-pipeline/index.ts
```

Custom topic:

```bash
TOPIC="Why Rust is becoming popular for systems programming" \
OPENAI_API_KEY=sk-... npx tsx examples/08-workflow-pipeline/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |
| `TOPIC` | ❌ | Functional programming | The article topic |

## Expected Output

```
=== 08 - Workflow Pipeline ===

📝  Topic: "The benefits of functional programming"

🚀  Starting pipeline...

──────────────────────────────────────────────────
📌  Running steps
──────────────────────────────────────────────────
   ✅  Step 1 "research" done [2.3s]
   📄  Output preview: • Immutability reduces bugs by preventing accidental state changes...

   ✅  Step 2 "outline" done [4.1s]
   ...

──────────────────────────────────────────────────
📌  Final Review
──────────────────────────────────────────────────
Score: 8/10
Strengths: 1) Clear structure...
```
