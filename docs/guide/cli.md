# CLI Usage

The `@openlinkos/cli` package provides the `openlinkos` command-line tool for running agents and teams without writing boilerplate code.

## Installation

```bash
pnpm add -g @openlinkos/cli
```

Or run directly with `npx`:

```bash
npx @openlinkos/cli <command>
```

## Commands

### `openlinkos run`

Run an agent defined in a configuration file:

```bash
openlinkos run agent.ts
```

The file should export an agent or team:

```typescript
// agent.ts
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

const model = createModel("openai:gpt-4o");

export default createAgent({
  name: "assistant",
  model,
  systemPrompt: "You are a helpful assistant.",
});
```

Pass input directly:

```bash
openlinkos run agent.ts --input "What is TypeScript?"
```

### `openlinkos chat`

Start an interactive chat session with an agent:

```bash
openlinkos chat agent.ts
```

This opens a REPL where you can type messages and receive responses. Type `exit` or press `Ctrl+C` to quit.

### `openlinkos team`

Run a team configuration file:

```bash
openlinkos team team.ts --input "Write a blog post about Rust"
```

```typescript
// team.ts
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam } from "@openlinkos/team";

const model = createModel("openai:gpt-4o");

const researcher = createAgent({
  name: "researcher",
  model,
  systemPrompt: "Research topics thoroughly.",
});

const writer = createAgent({
  name: "writer",
  model,
  systemPrompt: "Write clear articles based on research.",
});

export default createTeam({
  name: "content-team",
  agents: [researcher, writer],
  coordinationMode: "sequential",
});
```

### `openlinkos init`

Scaffold a new agent project:

```bash
openlinkos init my-agent
cd my-agent
pnpm install
```

This creates a project with a basic agent configuration, `tsconfig.json`, and `package.json`.

## Options

### Global Options

| Option | Description |
|--------|-------------|
| `--model <id>` | Override the model (e.g., `openai:gpt-4o`) |
| `--env <file>` | Load environment variables from a file |
| `--verbose` | Enable debug output |

### Run Options

| Option | Description |
|--------|-------------|
| `--input <text>` | Input text to send to the agent |
| `--output <file>` | Write the response to a file |

## Environment Variables

The CLI loads environment variables from `.env` files automatically. You can also specify a custom env file:

```bash
openlinkos run agent.ts --env .env.production
```

Example `.env` file:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Next Steps

- [AI API reference](/api/ai) — Model configuration options
- [Agent API reference](/api/agent) — Full agent configuration
- [Team API reference](/api/team) — Team coordination modes
