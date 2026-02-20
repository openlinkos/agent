/**
 * Basic Chatbot Example
 *
 * Demonstrates: createModel with a mock provider, createAgent with a
 * calculator tool, and a multi-turn conversation.
 *
 * Run: npx tsx chatbot.ts
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

// ---------------------------------------------------------------------------
// Mock provider — returns canned responses and handles tool calls
// ---------------------------------------------------------------------------

/** Simple mock provider that simulates an LLM with tool-calling support. */
function createMockProvider(): ModelProvider {
  let callCount = 0;

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
      const last = messages[messages.length - 1];
      const text =
        last.role === "user"
          ? `I heard you say: "${last.content}". How can I help further?`
          : "Is there anything else I can help with?";

      return {
        text,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      };
    },

    async stream(
      _messages: Message[],
      _options: ProviderRequestOptions,
    ): Promise<StreamResult> {
      throw new Error("Streaming not implemented in mock provider");
    },

    async generateWithTools(
      messages: Message[],
      tools: ToolDefinition[],
      _options: ProviderRequestOptions,
    ): Promise<ModelResponse> {
      callCount++;
      const last = messages[messages.length - 1];

      // After a tool result has been returned, produce a final text answer
      if (last.role === "tool") {
        const result = last.content;
        return {
          text: `The answer is ${result}.`,
          toolCalls: [],
          usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
          finishReason: "stop",
        };
      }

      // If the user message looks like a math question, call the calculator tool
      const userMsg =
        last.role === "user" ? last.content : "";
      const hasMathKeyword = /calculat|math|\d+.*[\+\-\*\/\%].*\d+|what is \d+/i.test(
        userMsg,
      );
      const calcTool = tools.find((t) => t.name === "calculate");

      if (hasMathKeyword && calcTool) {
        // Extract a simple expression (or use a default)
        const match = userMsg.match(/(\d[\d\s\+\-\*\/\.\(\)\%]*\d)/);
        const expression = match ? match[1].trim() : "2 + 2";

        return {
          text: null,
          toolCalls: [
            {
              id: `call_${callCount}`,
              name: "calculate",
              arguments: { expression },
            },
          ],
          usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
          finishReason: "tool_calls",
        };
      }

      // Default conversational response
      return {
        text: `You said: "${userMsg}". I'm a helpful chatbot! Try asking me to calculate something, like "What is 42 * 13?"`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 },
        finishReason: "stop",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Basic Chatbot Example ===\n");

  // 1. Register the mock provider and create a model
  clearProviders();
  registerProvider(createMockProvider());
  const model = createModel("mock:chatbot-v1");

  // 2. Create an agent with a calculator tool
  const agent = createAgent({
    name: "chatbot",
    model,
    systemPrompt:
      "You are a friendly chatbot that can help with math calculations.",
    tools: [
      {
        name: "calculate",
        description: "Evaluate a mathematical expression and return the result",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The math expression to evaluate (e.g. '2 + 2')",
            },
          },
          required: ["expression"],
        },
        execute: async (params: Record<string, unknown>): Promise<unknown> => {
          const expr = params.expression as string;
          // Safe evaluation using Function constructor for simple math
          const result = new Function(`"use strict"; return (${expr})`)();
          console.log(`  [Tool] calculate("${expr}") => ${result}`);
          return result;
        },
      },
    ],
    maxIterations: 5,
    hooks: {
      onStart: (input) =>
        console.log(`\n> User: ${input}`),
      onToolCall: (toolCall) =>
        console.log(`  [Calling tool: ${toolCall.name}]`),
      onEnd: (response) =>
        console.log(`  Bot: ${response.text}\n  [Tokens used: ${response.usage.totalTokens}]`),
    },
  });

  // 3. Run a multi-turn conversation
  const conversation = [
    "Hello! What can you do?",
    "Calculate 42 * 13 for me",
    "Thanks! Now what is 100 + 250",
    "Goodbye!",
  ];

  for (const message of conversation) {
    await agent.run(message);
    console.log();
  }

  console.log("=== Conversation complete ===");
}

main().catch(console.error);
