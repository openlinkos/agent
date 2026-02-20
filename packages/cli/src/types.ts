/**
 * Core types for the @openlinkos/cli package.
 *
 * Defines CLI options, agent definition file structure, and configuration.
 */

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

/** Global CLI options available on all commands. */
export interface GlobalOptions {
  /** Override the model identifier (e.g. "openai:gpt-4o"). */
  model?: string;
  /** Enable verbose/debug output. */
  verbose?: boolean;
}

/** Options for the `run` command. */
export interface RunOptions extends GlobalOptions {
  /** Path to the agent definition file. */
  file?: string;
  /** Input text (skips interactive prompt). */
  input?: string;
}

/** Options for the `init` command. */
export interface InitOptions extends GlobalOptions {
  /** Directory to scaffold the project in. Defaults to current directory. */
  directory?: string;
}

/** Options for the `chat` command. */
export interface ChatOptions extends GlobalOptions {
  /** System prompt override. */
  systemPrompt?: string;
}

/** Options for the `team` command. */
export interface TeamOptions extends GlobalOptions {
  /** Path to the team definition file. */
  file: string;
  /** Input text (skips interactive prompt). */
  input?: string;
}

// ---------------------------------------------------------------------------
// Agent definition file
// ---------------------------------------------------------------------------

/**
 * The shape of an agent definition file's default export.
 *
 * Agent definition files (JS/TS) should default-export an object matching
 * this interface or an Agent instance from @openlinkos/agent.
 */
export interface AgentDefinition {
  /** Agent name. */
  name: string;
  /** Model identifier (e.g. "openai:gpt-4o"). */
  model: string;
  /** System prompt. */
  systemPrompt: string;
  /** Optional tool definitions. */
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (params: Record<string, unknown>) => Promise<unknown>;
  }>;
  /** Maximum iterations for the agent loop. */
  maxIterations?: number;
}
