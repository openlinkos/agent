/**
 * CLI entry point for @openlinkos/cli.
 *
 * Parses arguments and dispatches to the appropriate command.
 */

import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { chatCommand } from "./commands/chat.js";
import { teamCommand } from "./commands/team.js";

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

export function createProgram(): Command {
  const program = new Command();

  program
    .name("openlinkos")
    .description("OpenLinkOS Agent Framework CLI")
    .version("0.1.0")
    .option("-v, --verbose", "Enable verbose/debug output")
    .option("-m, --model <model>", "Override model identifier (e.g. openai:gpt-4o)");

  // --- run command ---
  program
    .command("run")
    .description("Run an agent definition file")
    .argument("<file>", "Path to the agent definition file (JS/TS)")
    .option("-i, --input <text>", "Input text (skips interactive prompt)")
    .action(async (file: string, cmdOpts: { input?: string }, cmd: Command) => {
      const globalOpts = cmd.parent?.opts() ?? {};
      await runCommand(file, {
        input: cmdOpts.input,
        verbose: globalOpts.verbose,
      });
    });

  // --- init command ---
  program
    .command("init")
    .description("Scaffold a new agent project")
    .argument("[directory]", "Directory to create the project in", ".")
    .action(async (directory: string, _cmdOpts: unknown, cmd: Command) => {
      const globalOpts = cmd.parent?.opts() ?? {};
      await initCommand({
        directory,
        model: globalOpts.model,
        verbose: globalOpts.verbose,
      });
    });

  // --- chat command ---
  program
    .command("chat")
    .description("Interactive chat with an agent")
    .argument("<file>", "Path to the agent definition file (JS/TS)")
    .action(async (file: string) => {
      await chatCommand(file);
    });

  // --- team command ---
  program
    .command("team")
    .description("Run a team configuration file")
    .argument("<file>", "Path to the team config file (JS/TS)")
    .option("-i, --input <text>", "Input text (skips interactive prompt)")
    .action(async (file: string, cmdOpts: { input?: string }, cmd: Command) => {
      const globalOpts = cmd.parent?.opts() ?? {};
      await teamCommand(file, {
        input: cmdOpts.input,
        verbose: globalOpts.verbose,
      });
    });

  return program;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const program = createProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
