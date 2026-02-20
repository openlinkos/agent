/**
 * @openlinkos/cli — Command-line tool for the OpenLinkOS Agent Framework.
 *
 * Run, chat with, and scaffold agent projects from the terminal.
 *
 * @packageDocumentation
 */

// --- Core types ---
export type {
  GlobalOptions,
  RunOptions,
  InitOptions,
  ChatOptions,
  TeamOptions,
  AgentDefinition,
} from "./types.js";

// --- Configuration ---
export { loadEnv, loadAgentFile, loadTeamFile, isTeamLike, resolveModelId } from "./config.js";

// --- Loader utilities ---
export { loadConfigFile, isAgentLike } from "./utils/loader.js";
export type { LoadResult } from "./utils/loader.js";

// --- Output formatting ---
export {
  bold,
  dim,
  red,
  green,
  yellow,
  blue,
  cyan,
  info,
  success,
  warn,
  error,
  debug,
  header,
  formatUsage,
} from "./output.js";

// --- Commands ---
export { runCommand } from "./commands/run.js";
export { initCommand } from "./commands/init.js";
export { chatCommand } from "./commands/chat.js";
export { teamCommand } from "./commands/team.js";

// --- CLI program ---
export { createProgram } from "./cli.js";
