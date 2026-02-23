/**
 * 05 - Multi-Agent Debate
 *
 * Two agents argue opposing positions on a topic over multiple rounds.
 * An optional judge agent evaluates the debate and picks a winner.
 * Demonstrates: createTeam, debate coordination mode, AgentRole, TeamHooks.
 *
 * Run: npx tsx examples/05-multi-agent-debate/index.ts
 */

import "dotenv/config";
import {
  createModel,
  registerProvider,
  createOpenAIProvider,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam, type DebateConfig } from "@openlinkos/team";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;
const DEBATE_TOPIC =
  process.env.DEBATE_TOPIC ?? "Remote work is better than working in an office";

if (!OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY is not set.");
  console.log("\n💡  OPENAI_API_KEY=sk-... npx tsx examples/05-multi-agent-debate/index.ts\n");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("=== 05 - Multi-Agent Debate ===\n");
  console.log(`📣  Topic: "${DEBATE_TOPIC}"\n`);

  registerProvider(createOpenAIProvider());

  const makeModel = (temperature = 0.8) =>
    createModel(`openai:${MODEL}`, {
      apiKey: OPENAI_API_KEY,
      ...(BASE_URL ? { baseURL: BASE_URL } : {}),
      temperature,
      maxTokens: 512,
    });

  // Proponent agent — argues IN FAVOR
  const proponent = createAgent({
    name: "proponent",
    model: makeModel(0.8),
    systemPrompt:
      `You are a skilled debater arguing STRONGLY IN FAVOR of the position. ` +
      `Be persuasive, cite evidence, counter opposing arguments. Keep responses to 3-4 sentences.`,
  });

  // Opponent agent — argues AGAINST
  const opponent = createAgent({
    name: "opponent",
    model: makeModel(0.8),
    systemPrompt:
      `You are a skilled debater arguing STRONGLY AGAINST the position. ` +
      `Be persuasive, cite evidence, counter opposing arguments. Keep responses to 3-4 sentences.`,
  });

  // Judge agent — evaluates the debate
  const judge = createAgent({
    name: "judge",
    model: makeModel(0.3),
    systemPrompt:
      `You are an impartial judge evaluating a debate. ` +
      `Assess both sides objectively. Identify the strongest and weakest arguments. ` +
      `Declare a winner based on argument quality and evidence, not personal opinion. ` +
      `Keep your ruling to 5-6 sentences.`,
  });

  const debateConfig: DebateConfig = {
    name: "policy-debate",
    coordinationMode: "debate",
    agents: [
      { agent: proponent, role: "proponent", description: "Argues in favor" },
      { agent: opponent, role: "opponent", description: "Argues against" },
    ],
    rounds: 2,
    judge,
    hooks: {
      onRoundStart: (round) => {
        console.log(`\n${"─".repeat(50)}`);
        console.log(`🎙️  Round ${round}`);
        console.log("─".repeat(50));
      },
      onAgentStart: (name) => {
        const emoji = name === "proponent" ? "✅" : "❌";
        console.log(`\n${emoji}  ${name.toUpperCase()}:`);
      },
      onAgentEnd: (name, response) => {
        console.log(response.text);
        console.log(`   [${response.usage.totalTokens} tokens]`);
      },
      onRoundEnd: (round) => {
        console.log(`\n📍  End of Round ${round}`);
      },
    },
  };

  const team = createTeam(debateConfig);
  const result = await team.run(DEBATE_TOPIC);

  console.log(`\n${"═".repeat(50)}`);
  console.log("⚖️  JUDGE'S RULING:");
  console.log("═".repeat(50));
  console.log(result.finalOutput);
  console.log(`\n📊  Total tokens used: ${result.totalUsage.totalTokens}`);
  console.log(`🔄  Rounds completed: ${result.rounds}`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
