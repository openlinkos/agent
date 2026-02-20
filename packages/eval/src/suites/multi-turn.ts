/**
 * Multi-turn conversation eval suite.
 *
 * Contains 5 eval cases that test an agent's ability to handle
 * multi-turn conversations (context retention, follow-up questions).
 *
 * Note: Multi-turn cases use a single input string with turn delimiters.
 * The eval runner sends this as a single prompt; the agent is expected
 * to handle the full conversation context.
 */

import type { EvalSuite, EvalCase } from "../types.js";
import { createIncludesScorer } from "../scorers/includes.js";

const multiTurnCases: EvalCase[] = [
  {
    input: "My name is Alice. What is my name?",
    expected: ["Alice"],
    metadata: {
      description: "Basic context retention — remember user's name",
      turns: 2,
    },
  },
  {
    input: "I have 5 apples. I eat 2. I buy 3 more. How many apples do I have?",
    expected: ["6"],
    metadata: {
      description: "Arithmetic across multiple statements",
      turns: 3,
    },
  },
  {
    input: "The capital of France is Paris. The capital of Germany is Berlin. What are the capitals of France and Germany?",
    expected: ["Paris", "Berlin"],
    metadata: {
      description: "Recall multiple facts from context",
      turns: 2,
    },
  },
  {
    input: "Set the language to Spanish. Now translate 'Good morning' to the language I set.",
    expected: ["Buenos", "días"],
    metadata: {
      description: "Follow instructions referencing earlier context",
      turns: 2,
    },
  },
  {
    input: "I am building a web app with React and TypeScript. What testing framework would you recommend for my stack?",
    expected: ["Jest", "Vitest", "Testing Library"],
    metadata: {
      description: "Context-aware recommendation",
      turns: 1,
    },
  },
];

/**
 * Create a multi-turn conversation eval suite.
 */
export function createMultiTurnSuite(): EvalSuite {
  return {
    name: "multi-turn",
    cases: multiTurnCases,
    scorer: createIncludesScorer({ ignoreCase: true, requireAll: false }),
    threshold: 0.5,
  };
}
