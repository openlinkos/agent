/**
 * 04 - Structured Output
 *
 * Ask the model to return structured JSON objects validated against a schema.
 * Demonstrates: generateObject, JSONSchema, type-safe structured responses.
 *
 * Run: npx tsx examples/04-structured-output/index.ts
 */

import "dotenv/config";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
  generateObject,
  type JSONSchema,
} from "@openlinkos/ai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/04-structured-output/index.ts\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Schema definitions and TypeScript types
// ---------------------------------------------------------------------------

interface BookReview {
  title: string;
  author: string;
  rating: number;
  summary: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

const bookReviewSchema: JSONSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Book title" },
    author: { type: "string", description: "Author name" },
    rating: { type: "number", description: "Rating from 1 to 10" },
    summary: { type: "string", description: "Brief summary of the book (2-3 sentences)" },
    pros: {
      type: "array",
      items: { type: "string" },
      description: "List of positive aspects",
    },
    cons: {
      type: "array",
      items: { type: "string" },
      description: "List of negative aspects or limitations",
    },
    recommended: { type: "boolean", description: "Whether you recommend the book" },
  },
  required: ["title", "author", "rating", "summary", "pros", "cons", "recommended"],
};

interface TaskList {
  tasks: Array<{
    id: number;
    title: string;
    priority: "low" | "medium" | "high";
    estimatedHours: number;
    tags: string[];
  }>;
  totalEstimatedHours: number;
}

const taskListSchema: JSONSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          title: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          estimatedHours: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["id", "title", "priority", "estimatedHours", "tags"],
      },
    },
    totalEstimatedHours: { type: "number" },
  },
  required: ["tasks", "totalEstimatedHours"],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== 04 - Structured Output ===\n");

  registerProvider(createOpenAIProvider());

  const model = createModel(
    `openai:${MODEL}`,
    {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature: 0.3,
      maxTokens: 1024,
    },
  );

  // --- Example 1: Book Review ---
  console.log("📚 Generating structured book review...\n");

  const { object: review, usage: reviewUsage } = await generateObject<BookReview>(
    model,
    bookReviewSchema,
    [
      {
        role: "user",
        content: "Write a review of 'The Pragmatic Programmer' by David Thomas and Andrew Hunt.",
      },
    ],
    { maxRetries: 2 },
  );

  console.log(`📖  "${review.title}" by ${review.author}`);
  console.log(`⭐  Rating: ${review.rating}/10`);
  console.log(`📝  Summary: ${review.summary}`);
  console.log(`✅  Pros:`);
  review.pros.forEach((p) => console.log(`    • ${p}`));
  console.log(`❌  Cons:`);
  review.cons.forEach((c) => console.log(`    • ${c}`));
  console.log(`💡  Recommended: ${review.recommended ? "Yes" : "No"}`);
  console.log(`📊  Tokens: ${reviewUsage.totalTokens}\n`);

  // --- Example 2: Task List ---
  console.log("📋 Generating structured task list...\n");

  const { object: taskList, usage: taskUsage } = await generateObject<TaskList>(
    model,
    taskListSchema,
    [
      {
        role: "user",
        content:
          "Create a task list for building a REST API with authentication. " +
          "Include 4 tasks with realistic time estimates.",
      },
    ],
    { maxRetries: 2 },
  );

  console.log("🗂️  Task List:");
  for (const task of taskList.tasks) {
    const priorityEmoji = { low: "🟢", medium: "🟡", high: "🔴" }[task.priority];
    console.log(`  ${task.id}. ${priorityEmoji} ${task.title}`);
    console.log(`     Priority: ${task.priority} | Est: ${task.estimatedHours}h | Tags: ${task.tags.join(", ")}`);
  }
  console.log(`\n⏱️  Total estimated: ${taskList.totalEstimatedHours} hours`);
  console.log(`📊  Tokens: ${taskUsage.totalTokens}`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
