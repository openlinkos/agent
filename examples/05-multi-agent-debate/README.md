# 05 - Multi-Agent Debate

Two AI agents argue opposing sides of a topic over multiple rounds. An optional judge evaluates the debate and declares a winner.

## What it demonstrates

- `createTeam` with `coordinationMode: "debate"`
- `DebateConfig` with `rounds` and `judge`
- `AgentRole` for assigning agents to positions
- `TeamHooks` for observing rounds and agent responses
- Multiple model instances with different system prompts

## Prerequisites

- An OpenAI-compatible API key
- Node.js ≥ 18

## Run

```bash
OPENAI_API_KEY=sk-... npx tsx examples/05-multi-agent-debate/index.ts
```

Customize the topic:

```bash
DEBATE_TOPIC="AI will replace most software developers by 2030" \
OPENAI_API_KEY=sk-... npx tsx examples/05-multi-agent-debate/index.ts
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Your OpenAI API key |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | ❌ | OpenAI default | Custom base URL |
| `DEBATE_TOPIC` | ❌ | Remote work topic | The proposition to debate |

## Expected Output

```
=== 05 - Multi-Agent Debate ===

📣  Topic: "Remote work is better than working in an office"

──────────────────────────────────────────────────
🎙️  Round 1
──────────────────────────────────────────────────

✅  PROPONENT:
Remote work eliminates commuting stress and gives employees autonomy...

❌  OPPONENT:
In-office collaboration fosters spontaneous innovation and team cohesion...

══════════════════════════════════════════════════
⚖️  JUDGE'S RULING:
══════════════════════════════════════════════════
Both sides presented compelling arguments...
```
