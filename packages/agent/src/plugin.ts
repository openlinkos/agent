/**
 * Plugin system for @openlinkos/agent.
 *
 * A plugin bundles middleware(s) and tool(s) into a reusable unit
 * that can be installed on an agent via `agent.use(plugin)`.
 */

import type { Middleware } from "./middleware.js";
import type { ToolDefinition } from "./types.js";

/**
 * A plugin that can be installed on an agent.
 *
 * Plugins bundle related middleware and tools together. When installed,
 * their middleware is added to the agent's middleware stack and their
 * tools are registered in the agent's tool registry.
 */
export interface Plugin {
  /** Unique plugin name. */
  name: string;
  /** Plugin version (semver string). */
  version: string;
  /** Middleware provided by this plugin. */
  middlewares?: Middleware[];
  /** Tools provided by this plugin. */
  tools?: ToolDefinition[];
  /** Called when the plugin is installed on an agent. */
  onInstall?: () => void | Promise<void>;
  /** Called when the plugin is uninstalled from an agent. */
  onUninstall?: () => void | Promise<void>;
}
