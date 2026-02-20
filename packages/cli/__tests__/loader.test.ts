/**
 * Tests for the config module — file validation, model resolution, team detection.
 */

import { describe, it, expect } from "vitest";
import { resolveModelId, isTeamLike } from "../src/config.js";

// ---------------------------------------------------------------------------
// resolveModelId
// ---------------------------------------------------------------------------

describe("resolveModelId", () => {
  it("should return CLI model flag if provided", () => {
    expect(resolveModelId("anthropic:claude-sonnet-4-5", "openai:gpt-4o")).toBe(
      "anthropic:claude-sonnet-4-5",
    );
  });

  it("should return definition model if no CLI flag", () => {
    expect(resolveModelId(undefined, "openai:gpt-4o")).toBe("openai:gpt-4o");
  });

  it("should return default if neither CLI flag nor definition model", () => {
    expect(resolveModelId(undefined, undefined)).toBe("openai:gpt-4o");
  });

  it("should fall back to definition model for empty string CLI model", () => {
    expect(resolveModelId("", "openai:gpt-3.5")).toBe("openai:gpt-3.5");
  });

  it("should return default for two empty strings", () => {
    expect(resolveModelId("", "")).toBe("openai:gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// isTeamLike
// ---------------------------------------------------------------------------

describe("isTeamLike", () => {
  it("should return true for an object with name, run, and coordinationMode", () => {
    const team = {
      name: "test-team",
      coordinationMode: "sequential",
      run: async () => ({ finalOutput: "done" }),
    };
    expect(isTeamLike(team)).toBe(true);
  });

  it("should return true for all coordination modes", () => {
    for (const mode of ["sequential", "parallel", "debate", "supervisor", "custom"]) {
      expect(
        isTeamLike({ name: "t", coordinationMode: mode, run: async () => {} }),
      ).toBe(true);
    }
  });

  it("should return false for an object without coordinationMode", () => {
    const agent = {
      name: "test-agent",
      run: async () => ({ text: "hello" }),
    };
    expect(isTeamLike(agent)).toBe(false);
  });

  it("should return false if coordinationMode is not a string", () => {
    expect(
      isTeamLike({ name: "test", coordinationMode: 42, run: async () => {} }),
    ).toBe(false);
  });

  it("should return false for null", () => {
    expect(isTeamLike(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isTeamLike(undefined)).toBe(false);
  });

  it("should return false for a string", () => {
    expect(isTeamLike("not a team")).toBe(false);
  });

  it("should return false if run is not a function", () => {
    expect(
      isTeamLike({ name: "t", coordinationMode: "sequential", run: "nope" }),
    ).toBe(false);
  });

  it("should return false if name is not a string", () => {
    expect(
      isTeamLike({ name: 123, coordinationMode: "sequential", run: async () => {} }),
    ).toBe(false);
  });

  it("should return false if name is missing", () => {
    expect(
      isTeamLike({ coordinationMode: "sequential", run: async () => {} }),
    ).toBe(false);
  });
});
