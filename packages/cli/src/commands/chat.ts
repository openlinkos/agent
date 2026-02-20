/**
 * `openlinkos chat <file>` command — Interactive REPL chat with an agent.
 */

import { createInterface } from "node:readline";
import { loadConfigFile, isAgentLike } from "../utils/loader.js";
import * as display from "../utils/display.js";

// ---------------------------------------------------------------------------
// Chat command
// ---------------------------------------------------------------------------

/**
 * Execute the `chat` command.
 *
 * Loads an agent from a config file and starts an interactive REPL.
 * The agent's `run` method is called for each user input.
 */
export async function chatCommand(file: string): Promise<void> {
  const { module: exported } = await loadConfigFile(file);

  if (!isAgentLike(exported)) {
    throw new Error(
      "Config file must export an Agent (an object with `name` and `run` properties).",
    );
  }

  const agent = exported;

  display.header(`Chat with ${agent.name}`);
  display.info('Type "exit" or "quit" to end the session.');
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): Promise<string | null> =>
    new Promise((resolve) => {
      rl.question("> ", (answer) => {
        resolve(answer);
      });
      rl.on("close", () => resolve(null));
    });

  let running = true;
  while (running) {
    const input = await prompt();

    if (input === null || input === "exit" || input === "quit") {
      running = false;
      break;
    }

    if (input.trim() === "") continue;

    try {
      const result = await agent.run(input);
      const agentResult = result as { text?: string };
      const text = agentResult.text ?? String(result);
      display.formatAgentResponse(agent.name, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      display.error(`Error: ${msg}`);
    }
  }

  rl.close();
  display.success("Chat session ended.");
}
