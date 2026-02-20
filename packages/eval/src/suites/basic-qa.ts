/**
 * Basic Q&A eval suite.
 *
 * Contains 10 basic question-and-answer eval cases
 * for testing agent knowledge and response quality.
 */

import type { EvalSuite, EvalCase } from "../types.js";
import { createIncludesScorer } from "../scorers/includes.js";

const basicQACases: EvalCase[] = [
  {
    input: "What is the capital of France?",
    expected: ["Paris"],
    metadata: { category: "geography", difficulty: "easy" },
  },
  {
    input: "What programming language is TypeScript based on?",
    expected: ["JavaScript"],
    metadata: { category: "programming", difficulty: "easy" },
  },
  {
    input: "What is 2 + 2?",
    expected: ["4"],
    metadata: { category: "math", difficulty: "easy" },
  },
  {
    input: "What does HTTP stand for?",
    expected: ["HyperText Transfer Protocol"],
    metadata: { category: "technology", difficulty: "easy" },
  },
  {
    input: "What is the largest planet in our solar system?",
    expected: ["Jupiter"],
    metadata: { category: "astronomy", difficulty: "easy" },
  },
  {
    input: "Who wrote Romeo and Juliet?",
    expected: ["Shakespeare", "William Shakespeare"],
    metadata: { category: "literature", difficulty: "easy" },
  },
  {
    input: "What is the chemical symbol for water?",
    expected: ["H2O"],
    metadata: { category: "chemistry", difficulty: "easy" },
  },
  {
    input: "What is JSON?",
    expected: ["JavaScript Object Notation"],
    metadata: { category: "technology", difficulty: "medium" },
  },
  {
    input: "What year did the World Wide Web become publicly available?",
    expected: ["1991"],
    metadata: { category: "history", difficulty: "medium" },
  },
  {
    input: "What is the difference between a stack and a queue?",
    expected: ["LIFO", "FIFO"],
    metadata: { category: "computer-science", difficulty: "medium" },
  },
];

/**
 * Create a basic Q&A eval suite.
 */
export function createBasicQASuite(): EvalSuite {
  return {
    name: "basic-qa",
    cases: basicQACases,
    scorer: createIncludesScorer({ ignoreCase: true, requireAll: false }),
    threshold: 0.5,
  };
}
