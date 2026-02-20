/**
 * Supervisor Team Example
 *
 * Demonstrates: createTeam with supervisor coordination mode, one supervisor
 * agent delegating to two specialized worker agents.
 *
 * Run: npx tsx supervisor.ts
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
import { createTeam, type SupervisorConfig } from "@openlinkos/team";

// ---------------------------------------------------------------------------
// Mock provider — delegation-aware responses
// ---------------------------------------------------------------------------

function createSupervisorMockProvider(): ModelProvider {
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
      const lastMsg = messages[messages.length - 1];
      const userContent = lastMsg.role === "user" ? lastMsg.content : "";

      let text: string;

      if (systemContent.includes("supervisor") || systemContent.includes("manager") || systemContent.includes("coordinate")) {
        // Supervisor: check if worker results are available
        if (userContent.includes("Worker results from round")) {
          text =
            "[FINAL] ## WebAssembly for Web Developers: A Complete Guide\n\n" +
            "Based on our team's research and writing, here is the final deliverable:\n\n" +
            "WebAssembly (Wasm) is a binary instruction format that runs in the browser at near-native speed. " +
            "It complements JavaScript by handling computationally intensive tasks like image processing, " +
            "physics simulations, and cryptographic operations.\n\n" +
            "### Key Benefits\n" +
            "- Near-native execution speed (1.2-1.5x of native, vs 10-100x for JS)\n" +
            "- Language diversity (C, C++, Rust, Go)\n" +
            "- Secure sandboxed execution\n" +
            "- Broad browser support (95%+ global coverage)\n\n" +
            "### Getting Started\n" +
            "1. Write performance-critical code in Rust or C++\n" +
            "2. Compile to .wasm using Emscripten or wasm-pack\n" +
            "3. Load and instantiate in JavaScript\n" +
            "4. Call exported functions from your web app\n\n" +
            "This guide was produced collaboratively by our research and writing team.";
        } else {
          // Initial task — delegate to workers using [DELEGATE:] protocol
          text =
            "I'll coordinate this task. Here's my plan:\n\n" +
            "[DELEGATE: researcher] Investigate the key benefits, challenges, and current adoption of WebAssembly for web developers.\n" +
            "[DELEGATE: writer] Using the research findings, write a clear, well-structured guide to WebAssembly for web developers.";
        }
      } else if (systemContent.includes("research")) {
        text =
          "## Research Findings: WebAssembly\n\n" +
          "**What is WebAssembly?** A binary instruction format for a stack-based virtual machine, " +
          "designed as a portable compilation target for high-level languages.\n\n" +
          "**Key findings:**\n" +
          "- Performance: 1.2-1.5x slower than native code (vs 10-100x for JavaScript)\n" +
          "- Adoption: Used by Figma, Google Earth, AutoCAD, Unity\n" +
          "- Browser support: Chrome, Firefox, Safari, Edge (95%+ global coverage)\n" +
          "- Use cases: Gaming, image/video processing, CAD, cryptography, codecs\n" +
          "- Languages: C, C++, Rust, Go, AssemblyScript, Kotlin\n\n" +
          "**Challenges:** Debugging is harder than JavaScript, no direct DOM access, " +
          "larger initial download for complex modules.";
      } else if (systemContent.includes("writ")) {
        text =
          "## WebAssembly: A Practical Guide\n\n" +
          "WebAssembly (Wasm) is the web's answer to performance-critical computing. " +
          "If you've ever wished JavaScript could run faster for tasks like image manipulation " +
          "or physics simulations, Wasm is your solution.\n\n" +
          "### Why WebAssembly?\n" +
          "Unlike JavaScript, WebAssembly runs as pre-compiled bytecode, achieving speeds " +
          "within 1.2-1.5x of native code. Major applications like Figma and Google Earth " +
          "rely on it for complex rendering and computation.\n\n" +
          "### Your First Wasm Module\n" +
          "Write in Rust, compile with wasm-pack, then import in JavaScript.";
      } else {
        text = "I'll work on the assigned task.";
      }

      return {
        text,
        toolCalls: [],
        usage: { promptTokens: 40, completionTokens: 120, totalTokens: 160 },
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
  console.log("=== Supervisor Team Example ===\n");

  // 1. Set up mock provider
  clearProviders();
  registerProvider(createSupervisorMockProvider());
  const model = createModel("mock:supervisor-v1");

  // 2. Create the supervisor
  const manager = createAgent({
    name: "manager",
    model,
    systemPrompt: `You are a project manager and supervisor who coordinates a team.
When given a task:
1. Break it into specific sub-tasks
2. Delegate each sub-task to the most appropriate team member
3. Review the outputs from each team member
4. Synthesize a final, cohesive deliverable

Your team members are:
- researcher: finds and analyzes information
- writer: creates clear, well-structured content`,
  });

  // 3. Create specialized workers
  const researcher = createAgent({
    name: "researcher",
    model,
    systemPrompt: `You are a thorough researcher. When given a research task:
- Gather relevant facts and data
- Identify key themes and trends
- Provide well-organized findings`,
  });

  const writer = createAgent({
    name: "writer",
    model,
    systemPrompt: `You are a skilled technical writer. When given content to write:
- Use clear, concise language
- Structure content with headings and bullet points
- Include code examples where appropriate`,
  });

  // 4. Assemble the team
  const team = createTeam({
    name: "content-team",
    agents: [
      { agent: manager, role: "supervisor", description: "Coordinates the team" },
      { agent: researcher, role: "researcher", description: "Researches topics" },
      { agent: writer, role: "writer", description: "Writes content" },
    ],
    coordinationMode: "supervisor",
    supervisor: manager,
    maxRounds: 5,
    hooks: {
      onRoundStart: (round) => {
        console.log(`\n${"─".repeat(50)}`);
        console.log(`  Round ${round}`);
        console.log("─".repeat(50));
      },
      onAgentStart: (name, round) => {
        console.log(`\n  [Round ${round}] ${name} is working...`);
      },
      onAgentEnd: (name, response, round) => {
        console.log(`  [Round ${round}] ${name} finished (${response.usage.totalTokens} tokens)`);
        // Show a preview of the output
        const preview = response.text.split("\n")[0];
        console.log(`  Preview: ${preview}`);
      },
      onRoundEnd: (round) => {
        console.log(`\n  ✓ Round ${round} complete`);
      },
    },
  } as SupervisorConfig);

  // 5. Run the team
  const task = "Create a guide to WebAssembly for web developers";
  console.log(`Task: "${task}"`);

  const result = await team.run(task);

  console.log(`\n${"=".repeat(50)}`);
  console.log("  FINAL OUTPUT");
  console.log("=".repeat(50));
  console.log(result.finalOutput);
  console.log(`\nRounds: ${result.rounds}`);
  console.log(`Total tokens: ${result.totalUsage.totalTokens}`);

  // Show individual agent contributions
  console.log(`\n${"─".repeat(50)}`);
  console.log("  Agent Contributions");
  console.log("─".repeat(50));
  for (const agentResult of result.agentResults) {
    console.log(`\n  [${agentResult.agentName}]`);
    console.log(`  ${agentResult.text.split("\n")[0]}...`);
  }

  console.log("\n=== Supervisor team complete ===");
}

main().catch(console.error);
