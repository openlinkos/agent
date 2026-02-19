#!/usr/bin/env node

/**
 * @openlinkos/cli — Command-line interface for the OpenLinkOS Agent Framework.
 *
 * Scaffold new agent projects, run agents locally with hot reload,
 * build for production, and deploy to supported platforms.
 *
 * @packageDocumentation
 */

export interface CLICommand {
  /** The command name (e.g., "init", "dev", "build"). */
  name: string;
  /** A short description of the command. */
  description: string;
  /** Execute the command with the given arguments. */
  execute: (args: string[]) => Promise<void>;
}

const commands: Record<string, CLICommand> = {
  init: {
    name: "init",
    description: "Scaffold a new OpenLinkOS agent project",
    execute: async (_args: string[]) => {
      console.log("openlinkos init — coming in Phase 4");
    },
  },
  dev: {
    name: "dev",
    description: "Run an agent locally with hot reload",
    execute: async (_args: string[]) => {
      console.log("openlinkos dev — coming in Phase 4");
    },
  },
  build: {
    name: "build",
    description: "Build the agent project for production",
    execute: async (_args: string[]) => {
      console.log("openlinkos build — coming in Phase 4");
    },
  },
  deploy: {
    name: "deploy",
    description: "Deploy to a supported platform",
    execute: async (_args: string[]) => {
      console.log("openlinkos deploy — coming in Phase 4");
    },
  },
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const commandName = args[0];

  if (!commandName || commandName === "--help" || commandName === "-h") {
    console.log("OpenLinkOS CLI\n");
    console.log("Usage: openlinkos <command> [options]\n");
    console.log("Commands:");
    for (const cmd of Object.values(commands)) {
      console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
    }
    return;
  }

  const command = commands[commandName];
  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error('Run "openlinkos --help" for available commands.');
    process.exit(1);
  }

  await command.execute(args.slice(1));
}

main().catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
