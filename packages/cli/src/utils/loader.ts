/**
 * Dynamic config file loader.
 *
 * Loads an agent or team configuration from a JS/TS file by dynamically
 * importing it and extracting the default export.
 */

import { resolve } from "node:path";

/** Result of loading a config file — either an Agent or a Team (or raw config). */
export interface LoadResult {
  /** The default export from the config file. */
  module: unknown;
  /** The resolved absolute path. */
  filePath: string;
}

/**
 * Load a config module from a file path.
 *
 * Supports .js, .ts, .mjs, .mts files. For TypeScript files the caller
 * is responsible for running under a TS-capable loader (e.g. tsx, ts-node).
 *
 * @param filePath - Relative or absolute path to the config file.
 * @returns The loaded module and resolved path.
 */
export async function loadConfigFile(filePath: string): Promise<LoadResult> {
  const resolved = resolve(process.cwd(), filePath);

  try {
    const mod = await import(resolved);
    const exported = mod.default ?? mod;
    return { module: exported, filePath: resolved };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config file "${resolved}": ${message}`);
  }
}

/**
 * Validate that the loaded module looks like an Agent (has `name` and `run`).
 */
export function isAgentLike(obj: unknown): obj is { name: string; run: (input: string) => Promise<unknown> } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "run" in obj &&
    typeof (obj as Record<string, unknown>).name === "string" &&
    typeof (obj as Record<string, unknown>).run === "function"
  );
}

/**
 * Validate that the loaded module looks like a Team (has `name`, `coordinationMode`, and `run`).
 */
export function isTeamLike(obj: unknown): obj is { name: string; coordinationMode: string; run: (input: string) => Promise<unknown> } {
  return (
    isAgentLike(obj) &&
    "coordinationMode" in obj &&
    typeof (obj as Record<string, unknown>).coordinationMode === "string"
  );
}
