/**
 * Tests for the init command.
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "../src/commands/init.js";

// ---------------------------------------------------------------------------
// Init command tests
// ---------------------------------------------------------------------------

describe("initCommand", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  function makeTmpDir(): string {
    const dir = mkdtempSync(resolve(tmpdir(), "cli-init-test-"));
    tmpDirs.push(dir);
    return dir;
  }

  it("should create all scaffold files in an empty directory", async () => {
    const dir = makeTmpDir();
    const target = resolve(dir, "my-project");

    await initCommand({ directory: target, verbose: false });

    expect(existsSync(resolve(target, "agent.config.ts"))).toBe(true);
    expect(existsSync(resolve(target, ".env"))).toBe(true);
    expect(existsSync(resolve(target, ".gitignore"))).toBe(true);
    expect(existsSync(resolve(target, "package.json"))).toBe(true);
  });

  it("should not overwrite existing files", async () => {
    const dir = makeTmpDir();
    const target = resolve(dir, "existing");

    // First run creates files
    await initCommand({ directory: target, verbose: false });
    const originalContent = readFileSync(resolve(target, "agent.config.ts"), "utf-8");

    // Second run should skip existing files
    await initCommand({ directory: target, verbose: false });
    const afterContent = readFileSync(resolve(target, "agent.config.ts"), "utf-8");

    expect(afterContent).toBe(originalContent);
  });

  it("should create agent.config.ts with correct content", async () => {
    const dir = makeTmpDir();
    const target = resolve(dir, "check-content");

    await initCommand({ directory: target, verbose: false });

    const content = readFileSync(resolve(target, "agent.config.ts"), "utf-8");
    expect(content).toContain("createModel");
    expect(content).toContain("systemPrompt");
    expect(content).toContain("export default");
  });

  it("should create .env with API key placeholders", async () => {
    const dir = makeTmpDir();
    const target = resolve(dir, "env-test");

    await initCommand({ directory: target, verbose: false });

    const content = readFileSync(resolve(target, ".env"), "utf-8");
    expect(content).toContain("OPENAI_API_KEY");
  });

  it("should work with explicit directory set to '.'", async () => {
    const dir = makeTmpDir();
    const target = resolve(dir, "dot-test");

    await initCommand({ directory: target, verbose: false });
    expect(existsSync(resolve(target, "agent.config.ts"))).toBe(true);
    expect(existsSync(resolve(target, "package.json"))).toBe(true);
  });
});
