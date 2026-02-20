/**
 * `openlinkos init` command — Scaffold a new agent project.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { info, success, error, debug, bold, dim } from "../output.js";
import type { InitOptions } from "../types.js";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const AGENT_CONFIG_TEMPLATE = `import { createModel, registerProvider, createOpenAIProvider } from "@openlinkos/ai";
import { createAgent } from "@openlinkos/agent";

// Register the OpenAI provider
registerProvider(createOpenAIProvider());

// Create the model
const model = createModel("openai:gpt-4o");

// Export the agent definition
export default {
  name: "my-agent",
  model: "openai:gpt-4o",
  systemPrompt: "You are a helpful assistant. Answer questions clearly and concisely.",
  maxIterations: 5,
};
`;

const ENV_TEMPLATE = `# OpenLinkOS Agent Configuration
# Add your API keys here

OPENAI_API_KEY=your-api-key-here
# ANTHROPIC_API_KEY=your-api-key-here
# GOOGLE_API_KEY=your-api-key-here
`;

const GITIGNORE_TEMPLATE = `node_modules/
dist/
.env
*.log
`;

const PACKAGE_JSON_TEMPLATE = `{
  "name": "my-agent-project",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "openlinkos run agent.config.ts",
    "chat": "openlinkos chat"
  },
  "dependencies": {
    "@openlinkos/ai": "latest",
    "@openlinkos/agent": "latest",
    "@openlinkos/cli": "latest"
  }
}
`;

// ---------------------------------------------------------------------------
// Init command
// ---------------------------------------------------------------------------

interface FileToWrite {
  path: string;
  content: string;
  description: string;
}

/**
 * Execute the `init` command.
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const verbose = options.verbose ?? false;
  const dir = resolve(process.cwd(), options.directory ?? ".");

  try {
    debug(`Scaffolding in: ${dir}`, verbose);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      debug(`Created directory: ${dir}`, verbose);
    }

    const files: FileToWrite[] = [
      { path: join(dir, "agent.config.ts"), content: AGENT_CONFIG_TEMPLATE, description: "agent.config.ts" },
      { path: join(dir, ".env"), content: ENV_TEMPLATE, description: ".env" },
      { path: join(dir, ".gitignore"), content: GITIGNORE_TEMPLATE, description: ".gitignore" },
      { path: join(dir, "package.json"), content: PACKAGE_JSON_TEMPLATE, description: "package.json" },
    ];

    let created = 0;
    let skipped = 0;

    for (const file of files) {
      if (existsSync(file.path)) {
        info(`${dim("skip")} ${file.description} ${dim("(already exists)")}`);
        skipped++;
      } else {
        writeFileSync(file.path, file.content, "utf-8");
        info(`${bold("create")} ${file.description}`);
        created++;
      }
    }

    console.log("");
    success(`Project scaffolded! ${created} files created, ${skipped} skipped.`);
    console.log("");
    info("Next steps:");
    console.log(`  1. ${dim("cd")} ${options.directory ?? "."}`);
    console.log(`  2. Edit ${bold(".env")} with your API keys`);
    console.log(`  3. Edit ${bold("agent.config.ts")} to customize your agent`);
    console.log(`  4. Run ${bold("openlinkos run agent.config.ts")} to start`);
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error("Failed to scaffold project", msg);
    process.exitCode = 1;
  }
}
