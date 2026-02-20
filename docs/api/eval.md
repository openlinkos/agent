# @openlinkos/eval

Agent evaluation framework with scorers, reporters, and test suites.

## Installation

```bash
pnpm add @openlinkos/eval @openlinkos/agent @openlinkos/ai
```

## Overview

`@openlinkos/eval` provides tools for systematically evaluating agent quality. Define test cases, score responses with built-in or custom scorers, and generate reports.

## `runEval()`

Run an agent against a set of test cases:

```typescript
import { createModel } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { runEval, createExactMatchScorer } from "@openlinkos/eval";

const model = createModel("openai:gpt-4o");
const agent = createAgent({
  name: "qa-agent",
  model,
  systemPrompt: "Answer questions accurately and concisely.",
});

const results = await runEval(
  agent,
  [
    { input: "What is 2 + 2?", expected: "4" },
    { input: "Capital of France?", expected: "Paris" },
  ],
  createExactMatchScorer(),
);

for (const result of results) {
  console.log(`${result.case.input}: ${result.passed ? "PASS" : "FAIL"} (${result.score})`);
}
```

**Signature:**

```typescript
function runEval(
  agent: Agent,
  cases: EvalCase[],
  scorer: Scorer,
  options?: EvalRunOptions,
): Promise<EvalResult[]>
```

## `runEvalSuite()`

Run a complete evaluation suite:

```typescript
import { runEvalSuite, createBasicQASuite } from "@openlinkos/eval";

const suite = createBasicQASuite();
const summary = await runEvalSuite(agent, suite);

console.log(`Pass rate: ${summary.passRate}%`);
console.log(`Average score: ${summary.averageScore}`);
```

**Signature:**

```typescript
function runEvalSuite(
  agent: Agent,
  suite: EvalSuite,
  options?: EvalRunOptions,
): Promise<EvalSummary>
```

## Types

### `EvalCase`

```typescript
interface EvalCase {
  /** The input to send to the agent. */
  input: string;
  /** The expected output (string or array of acceptable answers). */
  expected: string | string[];
  /** Optional metadata for categorization. */
  metadata?: Record<string, unknown>;
}
```

### `EvalResult`

```typescript
interface EvalResult {
  case: EvalCase;
  response: AgentResponse;
  score: number;
  passed: boolean;
  details: string;
  duration: number;
}
```

### `EvalSuite`

```typescript
interface EvalSuite {
  name: string;
  cases: EvalCase[];
  scorer: Scorer;
}
```

### `EvalSummary`

```typescript
interface EvalSummary {
  suite: string;
  results: EvalResult[];
  passRate: number;
  averageScore: number;
  totalDuration: number;
}
```

## Built-in Scorers

### `createExactMatchScorer()`

Checks if the response exactly matches the expected output:

```typescript
import { createExactMatchScorer } from "@openlinkos/eval";

const scorer = createExactMatchScorer({ caseSensitive: false });
```

### `createIncludesScorer()`

Checks if the response contains the expected string:

```typescript
import { createIncludesScorer } from "@openlinkos/eval";

const scorer = createIncludesScorer({ caseSensitive: false });
```

### `createToolCallScorer()`

Checks if the agent made the expected tool calls:

```typescript
import { createToolCallScorer } from "@openlinkos/eval";

const scorer = createToolCallScorer({
  expectedCalls: [{ name: "get_weather", arguments: { city: "Tokyo" } }],
});
```

### `createLLMJudgeScorer()`

Uses another LLM to evaluate the response:

```typescript
import { createModel } from "@openlinkos/ai";
import { createLLMJudgeScorer } from "@openlinkos/eval";

const scorer = createLLMJudgeScorer({
  model: createModel("openai:gpt-4o"),
  criteria: "Is the response accurate, helpful, and well-structured?",
});
```

### Custom Scorer

Implement the `Scorer` interface:

```typescript
import type { Scorer } from "@openlinkos/eval";

const myScorer: Scorer = {
  name: "word-count",
  score: (response, expected) => {
    const wordCount = response.text.split(/\s+/).length;
    const target = parseInt(expected as string, 10);
    const diff = Math.abs(wordCount - target);
    return {
      score: Math.max(0, 1 - diff / target),
      passed: diff <= target * 0.2,
      details: `Word count: ${wordCount}, target: ${target}`,
    };
  },
};
```

### `Scorer`

```typescript
interface Scorer {
  readonly name: string;
  score(
    response: AgentResponse,
    expected: string | string[],
  ): ScorerResult | Promise<ScorerResult>;
}

interface ScorerResult {
  score: number;
  passed: boolean;
  details: string;
}
```

## Reporters

### Console Reporter

Print results to the terminal:

```typescript
import { createConsoleReporter } from "@openlinkos/eval";

const reporter = createConsoleReporter();
reporter.report(results);
```

### JSON Reporter

Output results as JSON:

```typescript
import { createJSONReporter } from "@openlinkos/eval";

const reporter = createJSONReporter({ pretty: true });
const json = reporter.report(results);
```

## Built-in Suites

### `createBasicQASuite()`

A general-purpose Q&A evaluation suite:

```typescript
import { createBasicQASuite } from "@openlinkos/eval";
const suite = createBasicQASuite();
```

### `createToolUseSuite()`

Tests whether agents use tools correctly:

```typescript
import { createToolUseSuite } from "@openlinkos/eval";
const suite = createToolUseSuite();
```

### `createMultiTurnSuite()`

Tests multi-turn conversation capabilities:

```typescript
import { createMultiTurnSuite } from "@openlinkos/eval";
const suite = createMultiTurnSuite();
```
