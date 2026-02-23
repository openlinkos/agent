/**
 * 08 - Workflow Pipeline
 *
 * A multi-step content generation pipeline:
 *   1. Research   — gather key facts about a topic
 *   2. Outline    — create a structured article outline
 *   3. Write      — expand the outline into a draft
 *   4. Review     — critique and score the draft
 *
 * Each step's output feeds into the next.
 * Demonstrates: createWorkflow, WorkflowStep, agent + fn steps, onStepComplete.
 *
 * Run: npx tsx examples/08-workflow-pipeline/index.ts
 */

import "dotenv/config";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent, createWorkflow } from "@openlinkos/agent";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;
const TOPIC = process.env.TOPIC ?? "The benefits of functional programming";

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/08-workflow-pipeline/index.ts\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(title: string): void {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`📌  ${title}`);
  console.log("─".repeat(50));
}

function preview(text: string, maxLen = 200): string {
  if (typeof text !== "string") return JSON.stringify(text);
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== 08 - Workflow Pipeline ===\n");
  console.log(`📝  Topic: "${TOPIC}"\n`);

  registerProvider(createOpenAIProvider());

  const makeModel = (temp = 0.7, maxTok = 512) =>
    createModel(`openai:${MODEL}`, {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature: temp,
      maxTokens: maxTok,
    });

  // Each step uses a specialized agent
  const researcher = createAgent({
    name: "researcher",
    model: makeModel(0.3, 400),
    systemPrompt:
      "You are a research assistant. Given a topic, list 5-7 key facts, " +
      "statistics, or insights. Be concise. Use bullet points.",
  });

  const outliner = createAgent({
    name: "outliner",
    model: makeModel(0.4, 400),
    systemPrompt:
      "You are a content strategist. Given research notes, create a structured " +
      "article outline with sections and sub-points. Keep it clear and logical.",
  });

  const writer = createAgent({
    name: "writer",
    model: makeModel(0.8, 800),
    systemPrompt:
      "You are a skilled technical writer. Given an outline, write an engaging " +
      "article draft. Use clear headings (##), concise paragraphs, and examples. " +
      "Aim for approximately 300 words.",
  });

  const reviewer = createAgent({
    name: "reviewer",
    model: makeModel(0.2, 400),
    systemPrompt:
      "You are a senior editor. Review the article draft and provide: " +
      "(1) an overall score out of 10, (2) 3 strengths, (3) 2 improvement suggestions. " +
      "Be specific and constructive.",
  });

  let stepCount = 0;
  const startTime = Date.now();

  const workflow = createWorkflow({
    name: "content-pipeline",
    onStepComplete: (stepName, result, index) => {
      stepCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✅  Step ${index + 1} "${stepName}" done [${elapsed}s]`);
      console.log(`   📄  Output preview: ${preview(result as string)}\n`);
    },
    steps: [
      {
        name: "research",
        agent: researcher,
        inputTransform: (input) => `Research this topic thoroughly: ${input as string}`,
        outputTransform: (output) => {
          const resp = output as { text: string };
          return resp.text;
        },
      },
      {
        name: "outline",
        agent: outliner,
        inputTransform: (researchNotes) =>
          `Create an article outline based on these research notes:\n\n${researchNotes as string}\n\nTopic: "${TOPIC}"`,
        outputTransform: (output) => {
          const resp = output as { text: string };
          return resp.text;
        },
      },
      {
        name: "write",
        agent: writer,
        inputTransform: (outline) =>
          `Write an article based on this outline:\n\n${outline as string}\n\nTopic: "${TOPIC}"`,
        outputTransform: (output) => {
          const resp = output as { text: string };
          return resp.text;
        },
      },
      {
        // Plain function step — adds metadata
        name: "add-metadata",
        fn: async (draft) => {
          const text = draft as string;
          const wordCount = text.trim().split(/\s+/).length;
          return {
            title: TOPIC,
            draft: text,
            wordCount,
            generatedAt: new Date().toISOString(),
          };
        },
      },
      {
        name: "review",
        agent: reviewer,
        inputTransform: (meta) => {
          const m = meta as { draft: string; wordCount: number };
          return `Please review this article draft (${m.wordCount} words):\n\n${m.draft}`;
        },
        outputTransform: (output) => {
          const resp = output as { text: string };
          return resp.text;
        },
      },
    ],
  });

  console.log("🚀  Starting pipeline...\n");
  section("Running steps");

  const result = await workflow.run(TOPIC);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  section("Final Review");
  console.log(result.result as string);

  section("Pipeline Summary");
  const meta = result.stepResults["add-metadata"] as { wordCount: number; generatedAt: string };
  console.log(`  • Steps completed: ${stepCount}`);
  console.log(`  • Article word count: ${meta.wordCount}`);
  console.log(`  • Total time: ${totalTime}s`);
  console.log(`  • Generated at: ${meta.generatedAt}`);

  // Print the full article
  section("Full Article Draft");
  const draft = result.stepResults["write"] as { text: string } | string;
  const articleText = typeof draft === "string" ? draft : draft.text;
  console.log(articleText);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
