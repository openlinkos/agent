# @openlinkos/eval

Agent evaluation framework with scorers, reporters, and built-in test suites — part of the [OpenLinkOS](https://github.com/openlinkos/agent) Agent Framework.

## Overview

`@openlinkos/eval` provides a systematic way to test and evaluate AI agents. Define evaluation cases, score responses using multiple strategies, and generate reports.

## Installation

```bash
pnpm add @openlinkos/eval
```

## Usage

```typescript
import { runEval, createExactMatchScorer } from "@openlinkos/eval";

const report = await runEval(agent, {
  name: "basic-qa",
  cases: [
    { input: "What is 2+2?", expected: "4" },
    { input: "Capital of France?", expected: "Paris" },
  ],
  scorer: createExactMatchScorer(),
});

console.log(`Pass rate: ${report.summary.passRate * 100}%`);
```

## Features

- **Built-in scorers** — Exact match, includes, tool-call, LLM judge
- **Reporters** — Console and JSON output formats
- **Test suites** — Pre-built suites for basic QA, multi-turn, and tool use
- **Eval runner** — Batch evaluation with progress tracking

## Scorers

| Scorer | Description |
|--------|-------------|
| `createExactMatchScorer()` | Exact string match |
| `createIncludesScorer()` | Substring inclusion |
| `createToolCallScorer()` | Validates tool call sequences |
| `createLLMJudgeScorer()` | LLM-based semantic evaluation |

## Documentation

See the [full documentation](https://openlinkos.com) for guides and API reference.

## License

[MIT](../../LICENSE)
