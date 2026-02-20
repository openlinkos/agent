/**
 * Tests for configuration loading.
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { resolveModelId } from "../src/config.js";

// ---------------------------------------------------------------------------
// resolveModelId tests
// ---------------------------------------------------------------------------

describe("resolveModelId", () => {
  it("should prefer CLI model override", () => {
    expect(resolveModelId("anthropic:claude-sonnet-4-5", "openai:gpt-4o")).toBe(
      "anthropic:claude-sonnet-4-5",
    );
  });

  it("should fall back to definition model when CLI is undefined", () => {
    expect(resolveModelId(undefined, "openai:gpt-4o")).toBe("openai:gpt-4o");
  });

  it("should fall back to default when both are undefined", () => {
    expect(resolveModelId(undefined, undefined)).toBe("openai:gpt-4o");
  });

  it("should use CLI model even when empty string would be falsy", () => {
    // Empty string is falsy, so it falls through
    expect(resolveModelId("", "openai:gpt-4o")).toBe("openai:gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// loadAgentFile tests
// ---------------------------------------------------------------------------

describe("loadAgentFile", () => {
  it("should throw for non-existent file", async () => {
    const { loadAgentFile } = await import("../src/config.js");
    await expect(loadAgentFile("/nonexistent/agent.js")).rejects.toThrow(
      "Agent file not found",
    );
  });

  it("should throw for unsupported file extension", async () => {
    // Create a temp file with .txt extension
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = resolve(process.cwd(), "__test_agent.txt");
    writeFileSync(tmpPath, "export default {}");
    try {
      const { loadAgentFile } = await import("../src/config.js");
      await expect(loadAgentFile(tmpPath)).rejects.toThrow(
        'Unsupported file extension ".txt"',
      );
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it("should load a valid JS agent file", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = resolve(process.cwd(), `__test_agent_${Date.now()}.mjs`);
    writeFileSync(
      tmpPath,
      `export default {
        name: "test-agent",
        model: "openai:gpt-4o",
        systemPrompt: "You are helpful.",
      };`,
    );
    try {
      const { loadAgentFile } = await import("../src/config.js");
      const def = await loadAgentFile(tmpPath);
      expect(def.name).toBe("test-agent");
      expect(def.model).toBe("openai:gpt-4o");
      expect(def.systemPrompt).toBe("You are helpful.");
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it("should throw when file has no name", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = resolve(process.cwd(), `__test_no_name_${Date.now()}.mjs`);
    writeFileSync(
      tmpPath,
      `export default { systemPrompt: "hello" };`,
    );
    try {
      const { loadAgentFile } = await import("../src/config.js");
      await expect(loadAgentFile(tmpPath)).rejects.toThrow('"name"');
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it("should throw when file has no systemPrompt", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const tmpPath = resolve(process.cwd(), `__test_no_prompt_${Date.now()}.mjs`);
    writeFileSync(
      tmpPath,
      `export default { name: "test" };`,
    );
    try {
      const { loadAgentFile } = await import("../src/config.js");
      await expect(loadAgentFile(tmpPath)).rejects.toThrow('"systemPrompt"');
    } finally {
      unlinkSync(tmpPath);
    }
  });
});

// ---------------------------------------------------------------------------
// loadEnv tests
// ---------------------------------------------------------------------------

describe("loadEnv", () => {
  it("should not throw regardless of .env presence", async () => {
    const { loadEnv } = await import("../src/config.js");
    // loadEnv silently handles missing .env files
    await expect(loadEnv(false)).resolves.toBeUndefined();
  });
});
