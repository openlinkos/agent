/**
 * Configuration loading for @openlinkos/cli.
 *
 * Handles .env file loading and agent definition file imports.
 */

import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import type { AgentDefinition } from "./types.js";

// ---------------------------------------------------------------------------
// .env loading
// ---------------------------------------------------------------------------

/**
 * Load environment variables from a .env file in the current directory.
 * Uses the `dotenv` package if available, silently skips otherwise.
 */
export async function loadEnv(verbose: boolean): Promise<void> {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    if (verbose) {
      console.error("[debug] No .env file found");
    }
    return;
  }

  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: envPath });
    if (verbose) {
      console.error("[debug] Loaded .env from", envPath);
    }
  } catch {
    if (verbose) {
      console.error("[debug] Failed to load dotenv");
    }
  }
}

// ---------------------------------------------------------------------------
// Agent definition loading
// ---------------------------------------------------------------------------

/**
 * Load an agent definition from a JS/TS file.
 *
 * The file should default-export an AgentDefinition object or an Agent instance.
 * For TypeScript files, the file must be pre-compiled or run with a TS loader.
 *
 * @param filePath - Path to the agent definition file.
 * @returns The loaded agent definition.
 */
export async function loadAgentFile(filePath: string): Promise<AgentDefinition> {
  const absPath = resolve(process.cwd(), filePath);

  if (!existsSync(absPath)) {
    throw new Error(`Agent file not found: ${absPath}`);
  }

  const ext = extname(absPath);
  if (![".js", ".mjs", ".ts", ".mts"].includes(ext)) {
    throw new Error(`Unsupported file extension "${ext}". Use .js, .mjs, .ts, or .mts`);
  }

  const fileUrl = pathToFileURL(absPath).href;
  const mod = await import(fileUrl);
  const definition = mod.default ?? mod;

  if (!definition || typeof definition !== "object") {
    throw new Error(`Agent file must export an object. Got: ${typeof definition}`);
  }

  if (!definition.name || typeof definition.name !== "string") {
    throw new Error('Agent definition must have a "name" property (string)');
  }

  if (!definition.systemPrompt || typeof definition.systemPrompt !== "string") {
    throw new Error('Agent definition must have a "systemPrompt" property (string)');
  }

  return definition as AgentDefinition;
}

// ---------------------------------------------------------------------------
// Team definition loading
// ---------------------------------------------------------------------------

/**
 * Load a team config from a JS/TS file.
 *
 * The file should default-export a Team instance (with `name`, `coordinationMode`,
 * and `run` method) or an object that can be used to create one.
 *
 * @param filePath - Path to the team config file.
 * @returns The loaded module's default export.
 */
export async function loadTeamFile(filePath: string): Promise<unknown> {
  const absPath = resolve(process.cwd(), filePath);

  if (!existsSync(absPath)) {
    throw new Error(`Team file not found: ${absPath}`);
  }

  const ext = extname(absPath);
  if (![".js", ".mjs", ".ts", ".mts"].includes(ext)) {
    throw new Error(`Unsupported file extension "${ext}". Use .js, .mjs, .ts, or .mts`);
  }

  const fileUrl = pathToFileURL(absPath).href;
  const mod = await import(fileUrl);
  const exported = mod.default ?? mod;

  if (!exported || typeof exported !== "object") {
    throw new Error(`Team file must export an object. Got: ${typeof exported}`);
  }

  return exported;
}

/**
 * Validate that an object looks like a Team instance.
 */
export function isTeamLike(obj: unknown): obj is { name: string; coordinationMode: string; run: (input: string) => Promise<unknown> } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "run" in obj &&
    "coordinationMode" in obj &&
    typeof (obj as Record<string, unknown>).name === "string" &&
    typeof (obj as Record<string, unknown>).run === "function" &&
    typeof (obj as Record<string, unknown>).coordinationMode === "string"
  );
}

/**
 * Resolve the model identifier from CLI flag, agent definition, or default.
 */
export function resolveModelId(cliModel?: string, definitionModel?: string): string {
  if (cliModel) return cliModel;
  if (definitionModel) return definitionModel;
  return "openai:gpt-4o";
}
