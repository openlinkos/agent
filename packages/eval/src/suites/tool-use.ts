/**
 * Tool use eval suite.
 *
 * Contains 10 eval cases that test an agent's ability to correctly
 * identify and use tools for various tasks.
 */

import type { EvalSuite, EvalCase } from "../types.js";
import { createToolCallScorer, type ToolCallPattern } from "../scorers/tool-call.js";

/** Cases include expected tool call patterns in metadata. */

const toolUseCases: EvalCase[] = [
  {
    input: "What's the weather in Tokyo?",
    expected: "get_weather",
    metadata: {
      expectedCalls: [{ name: "get_weather", arguments: { city: "Tokyo" } }],
    },
  },
  {
    input: "Calculate 15 * 23",
    expected: "calculate",
    metadata: {
      expectedCalls: [{ name: "calculate" }],
    },
  },
  {
    input: "Search for recent news about AI",
    expected: "search",
    metadata: {
      expectedCalls: [{ name: "search" }],
    },
  },
  {
    input: "Send an email to john@example.com saying hello",
    expected: "send_email",
    metadata: {
      expectedCalls: [{ name: "send_email" }],
    },
  },
  {
    input: "Read the file at /tmp/data.txt",
    expected: "read_file",
    metadata: {
      expectedCalls: [{ name: "read_file" }],
    },
  },
  {
    input: "Get the current time",
    expected: "get_time",
    metadata: {
      expectedCalls: [{ name: "get_time" }],
    },
  },
  {
    input: "Translate 'hello world' to Spanish",
    expected: "translate",
    metadata: {
      expectedCalls: [{ name: "translate" }],
    },
  },
  {
    input: "Search for information about TypeScript and then summarize the results",
    expected: "search",
    metadata: {
      expectedCalls: [{ name: "search" }, { name: "summarize" }],
    },
  },
  {
    input: "Create a new user account with username 'testuser'",
    expected: "create_user",
    metadata: {
      expectedCalls: [{ name: "create_user" }],
    },
  },
  {
    input: "List all files in the current directory",
    expected: "list_files",
    metadata: {
      expectedCalls: [{ name: "list_files" }],
    },
  },
];

/**
 * Create a tool use eval suite.
 *
 * Uses the tool-call scorer to verify the agent calls the expected tools.
 */
export function createToolUseSuite(): EvalSuite {
  // Default scorer checks for single tool call — suites can customize per case
  return {
    name: "tool-use",
    cases: toolUseCases,
    scorer: createToolCallScorer([{ name: "placeholder" }], { ordered: false, allowExtra: true }),
    threshold: 0.5,
  };
}

/**
 * Get the expected tool call patterns for a given case.
 */
export function getExpectedCalls(evalCase: EvalCase): ToolCallPattern[] {
  const calls = evalCase.metadata?.expectedCalls;
  if (Array.isArray(calls)) {
    return calls as ToolCallPattern[];
  }
  // Fallback: create a pattern from the expected string
  const expected = Array.isArray(evalCase.expected) ? evalCase.expected[0] : evalCase.expected;
  return [{ name: expected }];
}
