/**
 * LLM-as-judge scorer.
 *
 * Uses a model to evaluate agent responses against a rubric.
 * Returns a structured score based on the model's judgment.
 */

import type { Model, Message } from "@openlinkos/ai";
import type { AgentResponse } from "@openlinkos/agent";
import type { Scorer, ScorerResult } from "../types.js";

/** Configuration for the LLM judge scorer. */
export interface LLMJudgeConfig {
  /** The model to use as a judge. */
  model: Model;
  /** A prompt template for the judge. Use {{response}} and {{expected}} placeholders. */
  promptTemplate?: string;
  /** A rubric describing how to score the response. */
  rubric?: string;
  /** System prompt for the judge model. */
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are an evaluation judge. Score the quality of an AI agent's response.
You MUST respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reasoning": "<brief explanation>"}

Do not include any other text before or after the JSON.`;

const DEFAULT_PROMPT_TEMPLATE = `## Expected Output
{{expected}}

## Actual Response
{{response}}

{{rubric}}

Score the response from 0.0 (completely wrong) to 1.0 (perfect).
Respond with JSON: {"score": <number>, "reasoning": "<explanation>"}`;

/**
 * Create an LLM-as-judge scorer.
 *
 * The judge model evaluates the agent's response against the expected output
 * and returns a structured score.
 */
export function createLLMJudgeScorer(config: LLMJudgeConfig): Scorer {
  const {
    model,
    promptTemplate = DEFAULT_PROMPT_TEMPLATE,
    rubric = "Evaluate accuracy, completeness, and relevance.",
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = config;

  return {
    name: "llm-judge",

    async score(response: AgentResponse, expected: string | string[]): Promise<ScorerResult> {
      const expectedStr = Array.isArray(expected) ? expected.join("\n") : expected;

      const prompt = promptTemplate
        .replace("{{response}}", response.text ?? "")
        .replace("{{expected}}", expectedStr)
        .replace("{{rubric}}", rubric ? `## Rubric\n${rubric}` : "");

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      try {
        const judgeResponse = await model.generate(messages);
        const text = judgeResponse.text ?? "";

        // Parse the JSON response from the judge
        const jsonMatch = text.match(/\{[\s\S]*?"score"\s*:\s*-?[\d.]+[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { score: number; reasoning?: string };
          const score = Math.max(0, Math.min(1, parsed.score));
          return {
            score,
            details: parsed.reasoning ?? "LLM judge score.",
          };
        }

        // Fallback: try to extract just a number
        const numberMatch = text.match(/([\d.]+)/);
        if (numberMatch) {
          const score = Math.max(0, Math.min(1, parseFloat(numberMatch[1])));
          return { score, details: `LLM judge returned: ${text}` };
        }

        return { score: 0, details: `Could not parse LLM judge response: ${text}` };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { score: 0, details: `LLM judge error: ${error}` };
      }
    },
  };
}
