/**
 * `openlinkos team <file>` command — Run a team configuration file.
 */

import { createInterface } from "node:readline";
import { loadConfigFile, isTeamLike } from "../utils/loader.js";
import * as display from "../utils/display.js";

// ---------------------------------------------------------------------------
// Team command
// ---------------------------------------------------------------------------

export interface TeamCommandOptions {
  input?: string;
  verbose?: boolean;
}

/**
 * Execute the `team` command.
 */
export async function teamCommand(file: string, options: TeamCommandOptions = {}): Promise<void> {
  const { module: exported } = await loadConfigFile(file);

  if (!isTeamLike(exported)) {
    throw new Error(
      "Config file must export a Team (an object with `name`, `coordinationMode`, and `run` properties).",
    );
  }

  const team = exported;

  // Get input
  let input = options.input;

  if (input === undefined || input === null) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    input = await new Promise<string>((resolve) => {
      rl.question("Enter task: ", (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  if (!input || input.trim() === "") {
    throw new Error("No input provided.");
  }

  display.header(`Running team: ${team.name}`);
  display.info(`Mode: ${team.coordinationMode}`);

  const result = await team.run(input);

  const teamResult = result as {
    finalOutput: string;
    agentResults: Array<{ agentName: string; text: string }>;
    rounds: number;
    totalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  };

  // Display agent results
  if (teamResult.agentResults && teamResult.agentResults.length > 0) {
    console.log("");
    for (const agentResult of teamResult.agentResults) {
      display.label(`  [${agentResult.agentName}]`, agentResult.text);
    }
  }

  // Display final output
  console.log("");
  display.header("Final Output");
  console.log(teamResult.finalOutput ?? String(result));
  display.separator();

  display.success(
    `Team ${team.name} completed in ${teamResult.rounds ?? 1} round(s)`,
  );

  if (teamResult.totalUsage) {
    display.info(
      `tokens: prompt=${teamResult.totalUsage.promptTokens} completion=${teamResult.totalUsage.completionTokens} total=${teamResult.totalUsage.totalTokens}`,
    );
  }
}
