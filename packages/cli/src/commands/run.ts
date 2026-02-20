/**
 * `openlinkos run <file>` command — Run an agent definition file.
 */

import { createInterface } from "node:readline";
import { loadConfigFile, isAgentLike } from "../utils/loader.js";
import * as display from "../utils/display.js";

// ---------------------------------------------------------------------------
// Run command
// ---------------------------------------------------------------------------

export interface RunCommandOptions {
  input?: string;
  verbose?: boolean;
}

/**
 * Execute the `run` command.
 */
export async function runCommand(file: string, options: RunCommandOptions = {}): Promise<void> {
  const { module: exported } = await loadConfigFile(file);

  if (!isAgentLike(exported)) {
    throw new Error(
      "Config file must export an Agent (an object with `name` and `run` properties).",
    );
  }

  const agent = exported;

  // Get input
  let input = options.input;

  if (input === undefined || input === null) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    input = await new Promise<string>((resolve) => {
      rl.question("Enter input: ", (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  if (!input || input.trim() === "") {
    throw new Error("No input provided.");
  }

  display.header(`Running agent: ${agent.name}`);

  const result = await agent.run(input);

  const agentResult = result as {
    text?: string;
    agentName?: string;
    steps?: unknown[];
    toolCalls?: unknown[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  };

  const agentName = agentResult.agentName ?? agent.name;
  const text = agentResult.text ?? String(result);

  display.formatAgentResponse(agentName, text);

  if (agentResult.usage) {
    display.info(
      `tokens: prompt=${agentResult.usage.promptTokens} completion=${agentResult.usage.completionTokens} total=${agentResult.usage.totalTokens}`,
    );
  }

  display.success(`Agent ${agentName} completed.`);
}
