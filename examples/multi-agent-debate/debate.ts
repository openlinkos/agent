/**
 * Multi-Agent Debate Example
 *
 * Demonstrates: createTeam with debate coordination mode, two agents
 * arguing opposing sides of a topic, and an optional judge.
 *
 * Run: npx tsx debate.ts
 */

import {
  registerProvider,
  createModel,
  clearProviders,
  type ModelProvider,
  type ModelCapabilities,
  type Message,
  type ModelResponse,
  type ToolDefinition,
  type ProviderRequestOptions,
  type StreamResult,
} from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";
import { createTeam, type DebateConfig } from "@openlinkos/team";

// ---------------------------------------------------------------------------
// Mock provider — position-aware responses for debate
// ---------------------------------------------------------------------------

function createDebateMockProvider(): ModelProvider {
  const proponentCallCount = { value: 0 };
  const opponentCallCount = { value: 0 };

  const proponentResponses = [
    "A 4-day work week increases productivity by 20% according to multiple trials. Workers are more focused and motivated when they have adequate rest. Microsoft Japan saw a 40% productivity boost when they trialed it in 2019.",
    "My opponent raises valid concerns about implementation, but the evidence is clear: reduced burnout leads to lower healthcare costs and turnover. Companies like Buffer and Bolt have permanently adopted 4-day weeks with excellent results. The initial adjustment period is short-lived.",
    "In closing, the data overwhelmingly supports a 4-day work week. Higher productivity, better employee wellbeing, reduced carbon emissions from fewer commutes, and stronger talent attraction. The 5-day model is a relic of industrial-era thinking.",
  ];

  const opponentResponses = [
    "While productivity gains sound appealing, a 4-day work week creates serious coordination problems. Client-facing businesses cannot simply close an extra day. The cost of maintaining service coverage with fewer working days means hiring more staff, negating any savings.",
    "The studies cited are cherry-picked from tech companies with flexible work. Manufacturing, healthcare, retail, and education cannot easily compress schedules. Furthermore, compressing 40 hours into 4 days means 10-hour days, which research shows decreases cognitive performance.",
    "To summarize: a blanket 4-day policy ignores industry diversity, creates coordination overhead, and may simply redistribute work hours rather than reduce them. Flexible scheduling is a better solution that accommodates both employee needs and business requirements.",
  ];

  const judgeResponse =
    "After careful evaluation:\n\n" +
    "**Proponent's strongest points:** Cited concrete evidence (Microsoft Japan trial), addressed multiple benefit dimensions (productivity, wellbeing, environment).\n\n" +
    "**Opponent's strongest points:** Highlighted industry-specific limitations, questioned generalizability of studies, proposed a practical alternative.\n\n" +
    "**Ruling:** The proponent makes a compelling case for knowledge-work industries, but the opponent correctly identifies that a universal mandate is impractical. " +
    "The most balanced approach is industry-specific adoption with flexible scheduling as a baseline. The proponent wins on evidence quality; the opponent wins on practical applicability.";

  return {
    name: "mock",
    capabilities: {
      streaming: false,
      toolCalling: true,
      structuredOutput: false,
      systemMessages: true,
      vision: false,
    } satisfies ModelCapabilities,

    async generate(
      messages: Message[],
      _options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      const systemMsg = messages.find((m) => m.role === "system");
      const systemContent = systemMsg?.role === "system" ? systemMsg.content : "";

      let text: string;

      if (systemContent.includes("judge") || systemContent.includes("impartial")) {
        text = judgeResponse;
      } else if (systemContent.includes("IN FAVOR")) {
        const idx = Math.min(proponentCallCount.value, proponentResponses.length - 1);
        proponentCallCount.value++;
        text = proponentResponses[idx];
      } else if (systemContent.includes("AGAINST")) {
        const idx = Math.min(opponentCallCount.value, opponentResponses.length - 1);
        opponentCallCount.value++;
        text = opponentResponses[idx];
      } else {
        text = "I appreciate the discussion on this topic.";
      }

      return {
        text,
        toolCalls: [],
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        finishReason: "stop",
      };
    },

    async stream(): Promise<StreamResult> {
      throw new Error("Streaming not implemented in mock provider");
    },

    async generateWithTools(
      messages: Message[],
      _tools: ToolDefinition[],
      options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      return this.generate(messages, options);
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Multi-Agent Debate Example ===\n");

  // 1. Set up mock provider
  clearProviders();
  registerProvider(createDebateMockProvider());
  const model = createModel("mock:debate-v1");

  // 2. Create the debaters
  const proponent = createAgent({
    name: "proponent",
    model,
    systemPrompt: `You argue IN FAVOR of the given proposition.
Build your case with logical reasoning, evidence, and concrete examples.
Address counterarguments raised by the opponent.
Be persuasive but intellectually honest.`,
  });

  const opponent = createAgent({
    name: "opponent",
    model,
    systemPrompt: `You argue AGAINST the given proposition.
Build your case with logical reasoning, evidence, and concrete examples.
Address counterarguments raised by the proponent.
Be persuasive but intellectually honest.`,
  });

  // 3. Create the judge
  const judge = createAgent({
    name: "judge",
    model,
    systemPrompt: `You are an impartial judge evaluating a debate.
After reviewing all arguments, provide:
1. A summary of each side's strongest points
2. An analysis of which arguments were most compelling
3. Your final ruling with clear reasoning`,
  });

  // 4. Assemble the debate team
  const team = createTeam({
    name: "debate-team",
    agents: [proponent, opponent],
    coordinationMode: "debate",
    judge,
    rounds: 3,
    hooks: {
      onRoundStart: (round) => {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`  ROUND ${round}`);
        console.log("=".repeat(60));
      },
      onAgentStart: (name) => {
        console.log(`\n  --- ${name.toUpperCase()} ---`);
      },
      onAgentEnd: (_name, response) => {
        console.log(`  ${response.text.slice(0, 200)}${response.text.length > 200 ? "..." : ""}`);
      },
      onRoundEnd: (round) => {
        console.log(`\n  [Round ${round} complete]`);
      },
    },
  } as DebateConfig);

  // 5. Run the debate
  const topic = "Should companies adopt a 4-day work week?";
  console.log(`Topic: "${topic}"\n`);

  const result = await team.run(topic);

  console.log(`\n${"=".repeat(60)}`);
  console.log("  FINAL RULING");
  console.log("=".repeat(60));
  console.log(result.finalOutput);
  console.log(`\nTotal rounds: ${result.rounds}`);
  console.log(`Total tokens: ${result.totalUsage.totalTokens}`);
  console.log("\n=== Debate complete ===");
}

main().catch(console.error);
